import { prisma } from '../utils/prisma';
import { Request, Response, NextFunction } from 'express';

export async function listPrograms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentId } = req.query;
    const where: any = {};

    if (studentId) where.studentId = studentId as string;

    const programs = await prisma.program.findMany({
      where,
      include: {
        targets: { orderBy: { createdAt: 'asc' } },
        _count: { select: { targets: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ programs });
  } catch (error) {
    next(error);
  }
}

export async function getProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const program = await prisma.program.findUnique({
      where: { id: req.params.id as string },
      include: { targets: { orderBy: { createdAt: 'asc' } } },
    });

    if (!program) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }

    res.json({ program });
  } catch (error) {
    next(error);
  }
}

export async function createProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { studentId, name, description } = body;
    const userId = req.user?.userId;

    const program = await prisma.program.create({
      data: {
        studentId,
        createdById: userId!,
        name,
        description,
      },
    });

    res.status(201).json({ program });
  } catch (error) {
    next(error);
  }
}

export async function updateProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { name, description, status } = body;

    const program = await prisma.program.update({
      where: { id: req.params.id as string },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
      },
    });

    res.json({ program });
  } catch (error) {
    next(error);
  }
}

// ─── Targets ────────────────────────────────────────────────────────────────

export async function addTarget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { domain, skill, promptHierarchy, masteryPercentage, masteryConsecutive, notes } = body;

    const target = await prisma.target.create({
      data: {
        programId: req.params.programId as string,
        domain,
        skill,
        promptHierarchy: JSON.stringify(promptHierarchy || []),
        masteryPercentage: masteryPercentage || 80,
        masteryConsecutive: masteryConsecutive || 3,
        notes,
      },
    });

    res.status(201).json({ target });
  } catch (error) {
    next(error);
  }
}

export async function updateTarget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { domain, skill, promptHierarchy, masteryPercentage, masteryConsecutive, status, notes } = body;
    const data: any = {};

    if (domain) data.domain = domain;
    if (skill) data.skill = skill;        if (promptHierarchy) data.promptHierarchy = JSON.stringify(promptHierarchy);
    if (masteryPercentage) data.masteryPercentage = masteryPercentage;
    if (masteryConsecutive) data.masteryConsecutive = masteryConsecutive;        if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;

    // Auto-timestamp mastery
    if (status === 'MASTERED') data.masteredAt = new Date();

    const target = await prisma.target.update({
      where: { id: req.params.targetId as string || req.params.id as string },
      data,
    });

    res.json({ target });
  } catch (error) {
    next(error);
  }
}
