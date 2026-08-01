import { prisma } from '../utils/prisma';
import { Request, Response, NextFunction } from 'express';

export async function listStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const centerId = req.user?.centerId;
    const includeArchived = req.query.includeArchived as string;

    const where: any = { centerId };
    if (includeArchived !== 'true') where.isActive = true;

    const students = await prisma.student.findMany({
      where,
      include: {
        _count: { select: { programs: true, sessions: true } },
        supervisors: {
          include: { supervisor: { select: { id: true, name: true, email: true } } },
        },
        therapists: {
          include: { therapist: { select: { id: true, name: true, email: true } } },
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
    const    student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      include: {
        supervisors: {
          include: { supervisor: { select: { id: true, name: true, email: true } } },
        },
        therapists: {
          include: { therapist: { select: { id: true, name: true, email: true } } },
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

    const student = await prisma.student.create({
      data: {
        centerId: centerId!,
        name,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        guardianName,
        guardianEmail,
        guardianPhone,
      },
    });

    res.status(201).json({ student });
  } catch (error) {
    next(error);
  }
}

export async function updateStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { name, dateOfBirth, guardianName, guardianEmail, guardianPhone, isActive } = body;
    const data: any = {};

    if (name) data.name = name;
    if (dateOfBirth) data.dateOfBirth = new Date(dateOfBirth);
    if (guardianName !== undefined) data.guardianName = guardianName;
    if (guardianEmail !== undefined) data.guardianEmail = guardianEmail;
    if (guardianPhone !== undefined) data.guardianPhone = guardianPhone;
    if (isActive !== undefined) data.isActive = isActive;

    const student = await prisma.student.update({
      where: { id: req.params.id as string },
      data,
    });

    res.json({ student });
  } catch (error) {
    next(error);
  }
}

export async function archiveStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const student = await prisma.student.update({
      where: { id: req.params.id as string },
      data: { isActive: false, archivedAt: new Date() },
    });

    res.json({ student });
  } catch (error) {
    next(error);
  }
}

export async function assignSupervisor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
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
