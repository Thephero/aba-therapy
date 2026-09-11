import { prisma, containsInsensitive } from '../utils/prisma';
import { getStudentScope, canAccessStudent } from '../utils/access';
import { Request, Response, NextFunction } from 'express';

// Keep core student responses compatible while older production databases finish
// applying optional newer columns such as profileImageUrl.
const studentScalarSelect = {
  id: true,
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

    const student = await prisma.student.create({
      data: {
        centerId: centerId!,
        name,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        guardianName,
        guardianEmail,
        guardianPhone,
      },
      select: studentScalarSelect,
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
