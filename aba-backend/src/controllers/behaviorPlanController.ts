import { prisma } from '../utils/prisma';
import { canAccessStudent } from '../utils/access';
import { Request, Response, NextFunction } from 'express';

export async function listBehaviorPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.params.studentId as string;
    if (!req.user || !(await canAccessStudent(req.user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const plans = await prisma.behaviorPlan.findMany({
      where: { studentId },
      include: { _count: { select: { records: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // abcOptions is stored as JSON string; parse for the client
    const parsed = plans.map((p) => {
      let abcOptions: any = {};
      try { abcOptions = JSON.parse(p.abcOptions || '{}'); } catch { abcOptions = {}; }
      return { ...p, abcOptions };
    });

    res.json({ plans: parsed });
  } catch (error) {
    next(error);
  }
}

export async function createBehaviorPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.params.studentId as string;
    if (!req.user || !(await canAccessStudent(req.user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const { name, dataType, abcOptions } = req.body as Record<string, any>;

    if (!name || !dataType || !['FREQUENCY', 'DURATION'].includes(dataType)) {
      res.status(400).json({ error: 'Behavior name and data type (FREQUENCY or DURATION) are required' });
      return;
    }

    const plan = await prisma.behaviorPlan.create({
      data: {
        studentId,
        name,
        dataType,
        abcOptions: JSON.stringify(abcOptions || {}),
      },
    });

    res.status(201).json({ plan });
  } catch (error) {
    next(error);
  }
}

export async function updateBehaviorPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const planId = req.params.planId as string;

    const existing = await prisma.behaviorPlan.findUnique({
      where: { id: planId },
      select: { id: true, student: { select: { id: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Behavior plan not found' });
      return;
    }
    if (!req.user || !(await canAccessStudent(req.user, existing.student.id))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const { name, dataType, abcOptions, isActive } = req.body as Record<string, any>;
    const data: any = {};
    if (name) data.name = name;
    if (dataType && ['FREQUENCY', 'DURATION'].includes(dataType)) data.dataType = dataType;
    if (abcOptions !== undefined) data.abcOptions = JSON.stringify(abcOptions);
    if (isActive !== undefined) data.isActive = isActive;

    const plan = await prisma.behaviorPlan.update({ where: { id: planId }, data });
    res.json({ plan });
  } catch (error) {
    next(error);
  }
}

export async function deleteBehaviorPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const planId = req.params.planId as string;

    const existing = await prisma.behaviorPlan.findUnique({
      where: { id: planId },
      select: { id: true, student: { select: { id: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Behavior plan not found' });
      return;
    }
    if (!req.user || !(await canAccessStudent(req.user, existing.student.id))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    // Soft-delete: deactivate so historical records keep their link
    await prisma.behaviorPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });

    res.json({ message: 'Behavior plan deactivated' });
  } catch (error) {
    next(error);
  }
}
