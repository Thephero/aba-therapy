import { prisma, containsInsensitive } from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { Request, Response, NextFunction } from 'express';

const ROLES = ['CENTER_ADMIN', 'SUPERVISOR', 'THERAPIST', 'PARENT'] as const;
type UserRole = typeof ROLES[number];

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const centerId = req.user?.centerId;
    const role = req.query.role as string;
    const search = req.query.search as string;

    const where: any = { centerId };
    if (role) where.role = role;

    // Text search across name, email, and role
    if (search) {
      where.OR = [
        { name: containsInsensitive(search) },
        { email: containsInsensitive(search) },
        { role: containsInsensitive(search) },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true,
        _count: {
          select: {
            assignedStudents: true,
            assignedTherapists: true,
            myTherapists: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // For therapists, count their student assignments from StudentTherapist model
    const usersWithCounts = await Promise.all(users.map(async (u) => {
      let studentCount = u._count.assignedStudents; // for supervisors
      if (u.role === 'THERAPIST') {
        studentCount = await prisma.studentTherapist.count({ where: { therapistId: u.id } });
      }
      return {
        id: u.id, name: u.name, email: u.email, role: u.role,
        isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
        studentCount,
        therapistCount: u._count.myTherapists ?? 0,
      };
    }));

    res.json({ users: usersWithCounts });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const centerId = req.user?.centerId;
    const { name, email, password, role } = body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { centerId: centerId!, name, email, passwordHash, role: role as UserRole },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { name, email, role, isActive, password } = body;
    const data: any = {};

    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role as UserRole;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.passwordHash = await hashPassword(password);

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Soft delete
    await prisma.user.update({
      where: { id: req.params.id as string },
      data: { isActive: false, refreshToken: null },
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    next(error);
  }
}

// ─── Student Assignments (Staff → Students) ───────────────────────────────

export async function getUserStudentAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.id as string;
    const centerId = req.user?.centerId;

    // Get the user to check their role
    const staffUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, centerId: true },
    });

    if (!staffUser || staffUser.centerId !== centerId) {
      res.status(404).json({ error: 'User not found in your center' });
      return;
    }

    // Get all active students in the center
    const allStudents = await prisma.student.findMany({
      where: { centerId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Get assigned student IDs
    let assignedStudentIds: string[] = [];
    if (staffUser.role === 'SUPERVISOR') {
      const assignments = await prisma.studentSupervisor.findMany({
        where: { supervisorId: userId },
        select: { studentId: true },
      });
      assignedStudentIds = assignments.map(a => a.studentId);
    } else if (staffUser.role === 'THERAPIST') {
      const assignments = await prisma.studentTherapist.findMany({
        where: { therapistId: userId },
        select: { studentId: true },
      });
      assignedStudentIds = assignments.map(a => a.studentId);
    }

    res.json({
      user: { id: staffUser.id, role: staffUser.role },
      allStudents,
      assignedStudentIds,
    });
  } catch (error) {
    next(error);
  }
}

export async function assignStudentsToUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.id as string;
    const centerId = req.user?.centerId;
    const { studentIds } = req.body as { studentIds: string[] };

    if (!Array.isArray(studentIds)) {
      res.status(400).json({ error: 'studentIds must be an array' });
      return;
    }

    // Get the user to check their role
    const staffUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, centerId: true },
    });

    if (!staffUser || staffUser.centerId !== centerId) {
      res.status(404).json({ error: 'User not found in your center' });
      return;
    }

    if (staffUser.role !== 'SUPERVISOR' && staffUser.role !== 'THERAPIST') {
      res.status(400).json({ error: 'Can only assign students to supervisors and therapists' });
      return;
    }

    // Get current assignments
    let currentAssignedIds: string[] = [];
    if (staffUser.role === 'SUPERVISOR') {
      const current = await prisma.studentSupervisor.findMany({
        where: { supervisorId: userId },
        select: { studentId: true },
      });
      currentAssignedIds = current.map(a => a.studentId);
    } else {
      const current = await prisma.studentTherapist.findMany({
        where: { therapistId: userId },
        select: { studentId: true },
      });
      currentAssignedIds = current.map(a => a.studentId);
    }

    // Determine what to add and what to remove
    const toAdd = studentIds.filter(id => !currentAssignedIds.includes(id));
    const toRemove = currentAssignedIds.filter(id => !studentIds.includes(id));

    // Execute in a transaction
    await prisma.$transaction(async (tx) => {
      // Remove unselected students
      if (toRemove.length > 0) {
        if (staffUser.role === 'SUPERVISOR') {
          for (const studentId of toRemove) {
            await tx.studentSupervisor.delete({
              where: { studentId_supervisorId: { studentId, supervisorId: userId } },
            });
          }
        } else {
          for (const studentId of toRemove) {
            await tx.studentTherapist.delete({
              where: { studentId_therapistId: { studentId, therapistId: userId } },
            });
          }
        }
      }

      // Add newly selected students
      if (toAdd.length > 0) {
        if (staffUser.role === 'SUPERVISOR') {
          for (const studentId of toAdd) {
            await tx.studentSupervisor.create({
              data: { studentId, supervisorId: userId },
            });
          }
        } else {
          for (const studentId of toAdd) {
            await tx.studentTherapist.create({
              data: { studentId, therapistId: userId },
            });
          }
        }
      }
    });

    res.json({
      message: 'Student assignments updated',
      assignedStudentIds: studentIds,
      added: toAdd.length,
      removed: toRemove.length,
    });
  } catch (error) {
    next(error);
  }
}

// ─── Supervisor-Therapist Assignments ───────────────────────────────────────

export async function getMyTherapists(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    const centerId = req.user?.centerId;

    let assignments;
    if (req.user?.role === 'SUPERVISOR') {
      assignments = await prisma.supervisorTherapist.findMany({
        where: { supervisorId: userId },
        include: {
          therapist: { select: { id: true, name: true, email: true, isActive: true } },
        },
      });
    } else if (req.user?.role === 'CENTER_ADMIN') {
      // Admin sees all supervisor-therapist assignments in center
      const supervisors = await prisma.user.findMany({
        where: { centerId, role: 'SUPERVISOR', isActive: true },
        select: { id: true, name: true, email: true },
      });
      const therapistAssignments = await prisma.supervisorTherapist.findMany({
        where: { supervisor: { centerId } },
        include: {
          therapist: { select: { id: true, name: true, email: true, isActive: true } },
          supervisor: { select: { id: true, name: true, email: true } },
        },
      });
      res.json({ assignments: therapistAssignments, supervisors });
      return;
    } else {
      // Therapist sees their own supervisor
      assignments = await prisma.supervisorTherapist.findMany({
        where: { therapistId: userId },
        include: {
          supervisor: { select: { id: true, name: true, email: true } },
        },
      });
      res.json({ assignments });
      return;
    }

    res.json({ assignments });
  } catch (error) {
    next(error);
  }
}

export async function assignTherapistToSupervisor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { therapistId } = body;
    const supervisorId = req.params.id as string;

    const assignment = await prisma.supervisorTherapist.create({
      data: {
        supervisorId,
        therapistId,
      },
    });

    res.status(201).json({ assignment });
  } catch (error) {
    next(error);
  }
}

export async function removeTherapistFromSupervisor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supervisorId = req.params.id as string;
    const therapistId = (req.params as any).therapistId as string;

    await prisma.supervisorTherapist.delete({
      where: {
        supervisorId_therapistId: {
          supervisorId,
          therapistId,
        },
      },
    });

    res.json({ message: 'Therapist removed from supervisor' });
  } catch (error) {
    next(error);
  }
}
