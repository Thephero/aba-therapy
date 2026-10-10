import { prisma, containsInsensitive } from '../utils/prisma';
import { getStudentScope, canAccessStudent } from '../utils/access';
import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';

// Keep core student responses compatible while older production databases finish
// applying optional newer columns such as profileImageUrl.
const studentScalarSelect = {
  id: true,
  code: true,
  centerId: true,
  name: true,
  dateOfBirth: true,
  guardianName: true,
  guardianEmail: true,
  guardianPhone: true,
  isActive: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Student codes are short, stable, human-readable IDs (e.g. AZM-0001),
// unique per center. They anchor every related record for the upcoming
// LLM knowledge base, so they must never change once assigned.
async function generateStudentCode(tx: Prisma.TransactionClient, centerId: string): Promise<string> {
  // Count is kept > highest seen number to be safe with deleted/renumbered codes.
  const existing = await tx.student.findMany({
    where: { centerId, code: { not: null } },
    select: { code: true },
    orderBy: { code: 'desc' },
    take: 1,
  });
  const last = existing[0]?.code;
  const lastNum = last ? parseInt(last.split('-').pop() || '0', 10) : 0;
  let n = lastNum + 1;
  // Handle rare out-of-order codes with retries on collision.
  for (;;) {
    const code = `AZM-${String(n).padStart(4, '0')}`;
    const clash = await tx.student.findFirst({ where: { centerId, code } });
    if (!clash) return code;
    n += 1;
  }
}

export async function listStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const includeArchived = req.query.includeArchived as string;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where: any = { ...(await getStudentScope(req.user!)) };
    if (includeArchived !== 'true') where.isActive = true;
    if (search) {
      where.OR = [
        { name: containsInsensitive(search) },
        { guardianName: containsInsensitive(search) },
        { guardianEmail: containsInsensitive(search) },
        { guardianPhone: containsInsensitive(search) },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      select: {
        ...studentScalarSelect,
        _count: { select: { programs: true, sessions: true } },
        parent: { select: { id: true, name: true, email: true } },
        supervisors: {
          select: { supervisor: { select: { id: true, name: true, email: true } } },
        },
        therapists: {
          select: { therapist: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ students });
  } catch (error) {
    next(error);
  }
}

export async function getStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !(await canAccessStudent(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      select: {
        ...studentScalarSelect,
        parent: { select: { id: true, name: true, email: true } },
        supervisors: {
          select: { supervisor: { select: { id: true, name: true, email: true } } },
        },
        therapists: {
          select: { therapist: { select: { id: true, name: true, email: true } } },
        },
        programs: { include: { targets: true } },
        consentRecords: true,
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json({ student });
  } catch (error) {
    next(error);
  }
}

export async function createStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const centerId = req.user?.centerId;
    const { name, dateOfBirth, guardianName, guardianEmail, guardianPhone } = body;

    if (!req.user?.centerId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // ─── Subscription limit enforcement ───
    const subscription = await prisma.subscription.findUnique({ where: { centerId } });
    if (subscription) {
      // Expired trial counts as PAST_DUE even if no webhook has arrived yet.
      const trialExpired =
        subscription.status === 'TRIALING' &&
        !!subscription.trialEndsAt &&
        subscription.trialEndsAt.getTime() < Date.now();
      const blockedStatus = trialExpired || subscription.status === 'PAST_DUE' || subscription.status === 'CANCELED';
      const limitReached = subscription.activeStudentLimit != null;
      if (limitReached) {
        const activeStudents = await prisma.student.count({ where: { centerId, isActive: true } });
        if (activeStudents >= subscription.activeStudentLimit) {
          res.status(402).json({
            error: `Your plan allows ${subscription.activeStudentLimit} active students. Upgrade your subscription to add more.`,
            code: 'PLAN_LIMIT_REACHED',
          });
          return;
        }
      }
      if (blockedStatus) {
        res.status(402).json({
          error: trialExpired
            ? 'Your 14-day trial has ended. Subscribe to a plan to keep adding students.'
            : 'Your subscription is not active. Please update billing to continue.',
          code: 'SUBSCRIPTION_INACTIVE',
        });
        return;
      }
    }

    // Generate the stable student code in a transaction so two admins
    // creating students at the same moment can never collide.
    const student = await prisma.$transaction(async (tx) => {
      const code = await generateStudentCode(tx, centerId!);
      return tx.student.create({
        data: {
          centerId: centerId!,
          code,
          name,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          guardianName,
          guardianEmail,
          guardianPhone,
        },
        select: studentScalarSelect,
      });
    });

    res.status(201).json({ student });
  } catch (error) {
    next(error);
  }
}

export async function updateStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { name, dateOfBirth, guardianName, guardianEmail, guardianPhone, isActive, parentId, profileImageUrl } = body;

    if (profileImageUrl !== undefined && req.user?.role !== 'CENTER_ADMIN' && req.user?.role !== 'SUPERVISOR') {
      res.status(403).json({ error: 'Only center admins and supervisors can update profile images' });
      return;
    }
    const data: any = {};

    if (name) data.name = name;
    if (dateOfBirth) data.dateOfBirth = new Date(dateOfBirth);
    if (guardianName !== undefined) data.guardianName = guardianName;
    if (guardianEmail !== undefined) data.guardianEmail = guardianEmail;
    if (guardianPhone !== undefined) data.guardianPhone = guardianPhone;
    if (isActive !== undefined) data.isActive = isActive;
    // Link/unlink a parent account (empty string unlinks).
    if (parentId !== undefined) data.parentId = parentId === '' ? null : parentId;
    if (profileImageUrl !== undefined) {
      if (profileImageUrl !== null && typeof profileImageUrl !== 'string') {
        res.status(400).json({ error: 'Profile image must be a valid image URL' });
        return;
      }
      if (typeof profileImageUrl === 'string' && profileImageUrl.length > 2_000_000) {
        res.status(400).json({ error: 'Profile image is too large' });
        return;
      }
      data.profileImageUrl = profileImageUrl || null;
    }

    const studentAccess = await canAccessStudent(req.user!, req.params.id as string);
    if (!studentAccess) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const student = await prisma.student.update({
      where: { id: req.params.id as string },
      data,
      select: {
        ...studentScalarSelect,
        parent: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ student });
  } catch (error) {
    next(error);
  }
}

export async function archiveStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !(await canAccessStudent(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }
    const student = await prisma.student.update({
      where: { id: req.params.id as string },
      data: { isActive: false, archivedAt: new Date() },
      select: studentScalarSelect,
    });

    res.json({ student });
  } catch (error) {
    next(error);
  }
}

export async function assignSupervisor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !(await canAccessStudent(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }
    const body = req.body as Record<string, any>;
    const { supervisorId } = body;

    const assignment = await prisma.studentSupervisor.create({
      data: {
        studentId: req.params.id as string,
        supervisorId,
      },
    });

    res.status(201).json({ assignment });
  } catch (error) {
    next(error);
  }
}

export async function removeSupervisor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !(await canAccessStudent(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }
    const supervisorId = (req.params as any).supervisorId as string;

    await prisma.studentSupervisor.delete({
      where: {
        studentId_supervisorId: {
          studentId: req.params.id as string,
          supervisorId,
        },
      },
    });

    res.json({ message: 'Supervisor removed from student' });
  } catch (error) {
    next(error);
  }
}

// ─── Therapist Assignments ─────────────────────────────────────────────────

export async function assignTherapist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !(await canAccessStudent(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }
    const body = req.body as Record<string, any>;
    const { therapistId } = body;

    const assignment = await prisma.studentTherapist.create({
      data: {
        studentId: req.params.id as string,
        therapistId,
      },
    });

    res.status(201).json({ assignment });
  } catch (error) {
    next(error);
  }
}

export async function removeTherapist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !(await canAccessStudent(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }
    const therapistId = (req.params as any).therapistId as string;

    await prisma.studentTherapist.delete({
      where: {
        studentId_therapistId: {
          studentId: req.params.id as string,
          therapistId,
        },
      },
    });

    res.json({ message: 'Therapist removed from student' });
  } catch (error) {
    next(error);
  }
}
