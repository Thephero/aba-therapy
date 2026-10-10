import { prisma } from '../utils/prisma';
import { canAccessStudent } from '../utils/access';
import { Request, Response, NextFunction } from 'express';
import {
  GRIDS,
  GOAL_BANK,
} from '../services/assessmentGrids';
import {
  validateScores,
  aggregateScores,
  detectDeficits,
  evaluateAgainstPreviousAttempts,
  suggestGoals,
  generateSoapDraft,
  ScoreInput,
} from '../services/assessmentEngine';

// ─── Grid metadata for the frontend ─────────────────────────────────────────
export async function getGrids(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({
      grids: {
        VB_MAPP_GRID: {
          label: GRIDS.VB_MAPP_GRID.label,
          scoringScale: GRIDS.VB_MAPP_GRID.scoringScale,
          colorLegendByAssessment: GRIDS.VB_MAPP_GRID.colorLegendByAssessment,
          levels: GRIDS.VB_MAPP_GRID.levels,
          maxScorePerItem: GRIDS.VB_MAPP_GRID.maxScorePerItem,
          totalItems: GRIDS.VB_MAPP_GRID.totalItems,
        },
        ABLLS_GRID: {
          label: GRIDS.ABLLS_GRID.label,
          scoringScale: GRIDS.ABLLS_GRID.scoringScale,
          domainsAtoZ: GRIDS.ABLLS_GRID.domainsAtoZ,
          maxScorePerItem: GRIDS.ABLLS_GRID.maxScorePerItem,
          totalItems: GRIDS.ABLLS_GRID.totalItems,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Create assessment (score entry, draft or completed) ────────────────────
export async function createAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { studentId, assessmentType, attemptNumber, scores, status, notes } = body;

    if (!req.user || !studentId || !(await canAccessStudent(req.user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }
    if (!GRIDS[assessmentType]) {
      res.status(400).json({ error: 'assessmentType must be VB_MAPP_GRID or ABLLS_GRID' });
      return;
    }
    if (!Array.isArray(scores) || scores.length === 0) {
      res.status(400).json({ error: 'scores must be a non-empty array of { itemCode, domainCode, level, score }' });
      return;
    }

    const attempt = Number(attemptNumber) || 1;
    if (assessmentType === 'VB_MAPP_GRID' && (attempt < 1 || attempt > 4)) {
      res.status(400).json({ error: 'attemptNumber must be 1-4 for VB-MAPP' });
      return;
    }

    const validation = validateScores(assessmentType, scores as ScoreInput[]);
    if (!validation.valid) {
      res.status(400).json({ error: 'Score validation failed', details: validation.errors.slice(0, 20) });
      return;
    }

    // One record per type+attempt: replace any prior record for the same key
    await prisma.assessmentRecord.deleteMany({
      where: { studentId, assessmentType, attemptNumber: attempt },
    });

    const record = await prisma.assessmentRecord.create({
      data: {
        studentId,
        assessorId: req.user.userId,
        assessmentType,
        attemptNumber: attempt,
        status: status === 'DRAFT' ? 'DRAFT' : 'COMPLETED',
        notes: notes || null,
        scores: {
          create: (scores as ScoreInput[]).map((s) => ({
            itemCode: s.itemCode,
            domainCode: s.domainCode,
            level: s.level,
            score: s.score,
            notes: s.notes || null,
          })),
        },
      },
      include: { scores: true },
    });

    res.status(201).json({ assessment: record });
  } catch (error) {
    next(error);
  }
}

// ─── List assessments for a student ─────────────────────────────────────────
export async function listAssessments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.params.studentId as string;
    if (!req.user || !(await canAccessStudent(req.user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const records = await prisma.assessmentRecord.findMany({
      where: { studentId },
      include: {
        scores: true,
        assessor: { select: { id: true, name: true } },
        _count: { select: { scores: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ assessments: records });
  } catch (error) {
    next(error);
  }
}

// ─── Get one assessment with full evaluation ────────────────────────────────
export async function getAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const record = await prisma.assessmentRecord.findUnique({
      where: { id },
      include: { scores: true, assessor: { select: { id: true, name: true } } },
    });
    if (!record || !req.user || !(await canAccessStudent(req.user, record.studentId))) {
      res.status(403).json({ error: 'You do not have access to this assessment' });
      return;
    }

    const agg = aggregateScores(record.assessmentType, record.scores);
    const deficits = detectDeficits(record.assessmentType, record.scores);

    // Previous attempts of the same type for trend comparison
    const previousAttempts = await prisma.assessmentRecord.findMany({
      where: {
        studentId: record.studentId,
        assessmentType: record.assessmentType,
        attemptNumber: { lt: record.attemptNumber },
      },
      include: { scores: true },
      orderBy: { attemptNumber: 'desc' },
    });

    const { flags, changeVsPrevious } = evaluateAgainstPreviousAttempts(
      record.assessmentType,
      record.attemptNumber,
      record.scores,
      previousAttempts.map((p) => ({ attemptNumber: p.attemptNumber, scores: p.scores }))
    );

    const suggestedGoals = suggestGoals(record.assessmentType, record.scores, agg.domainTotals, 5);

    // Goals already saved for this student (from any assessment)
    const savedGoals = await prisma.studentGoal.findMany({
      where: { studentId: record.studentId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      assessment: {
        id: record.id,
        studentId: record.studentId,
        assessor: record.assessor,
        assessmentType: record.assessmentType,
        attemptNumber: record.attemptNumber,
        status: record.status,
        notes: record.notes,
        createdAt: record.createdAt,
        scores: record.scores,
      },
      evaluation: {
        ...agg,
        flags,
        changeVsPrevious,
        deficits,
        deficitCount: deficits.length,
        masteredCount: record.scores.filter((s) => s.score >= GRIDS[record.assessmentType].maxScorePerItem).length,
        suggestedGoals,
      },
      savedGoals,
    });
  } catch (error) {
    next(error);
  }
}

// ─── Update scores / status on an assessment ────────────────────────────────
export async function updateAssessmentScores(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const body = req.body as Record<string, any>;
    const { scores, status, notes } = body;

    const record = await prisma.assessmentRecord.findUnique({ where: { id } });
    if (!record || !req.user || !(await canAccessStudent(req.user, record.studentId))) {
      res.status(403).json({ error: 'You do not have access to this assessment' });
      return;
    }

    const data: any = { updatedAt: new Date() };
    if (notes !== undefined) data.notes = notes;
    if (status === 'DRAFT' || status === 'COMPLETED') data.status = status;

    if (Array.isArray(scores)) {
      const validation = validateScores(record.assessmentType, scores as ScoreInput[]);
      if (!validation.valid) {
        res.status(400).json({ error: 'Score validation failed', details: validation.errors.slice(0, 20) });
        return;
      }
      await prisma.assessmentScore.deleteMany({ where: { assessmentId: id } });
      await prisma.assessmentScore.createMany({
        data: scores.map((s: ScoreInput) => ({
          assessmentId: id,
          itemCode: s.itemCode,
          domainCode: s.domainCode,
          level: s.level,
          score: s.score,
          notes: s.notes || null,
        })),
      });
    }

    const updated = await prisma.assessmentRecord.update({
      where: { id },
      data,
      include: { scores: true },
    });

    res.json({ assessment: updated });
  } catch (error) {
    next(error);
  }
}

// ─── Goal actions (accept / modify / reject) ─────────────────────────────────
export async function actOnGoalSuggestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { assessmentId, targetId, action, title, operationalDefinition, measurementType, masteryCriteria } = body;

    const record = await prisma.assessmentRecord.findUnique({ where: { id: assessmentId } });
    if (!record || !req.user || !(await canAccessStudent(req.user, record.studentId))) {
      res.status(403).json({ error: 'You do not have access to this assessment' });
      return;
    }

    const goalEntry = GOAL_BANK.find((g) => g.targetId === targetId);
    if (!goalEntry) {
      res.status(400).json({ error: `Unknown targetId: ${targetId}` });
      return;
    }

    const act = String(action || 'ACCEPT').toUpperCase();
    if (!['ACCEPT', 'MODIFY', 'REJECT', 'CREATE_TARGET'].includes(act)) {
      res.status(400).json({ error: 'action must be ACCEPT, MODIFY, REJECT, or CREATE_TARGET' });
      return;
    }

    const data = {
      studentId: record.studentId,
      assessmentId,
      targetId,
      title: title || goalEntry.goalTitle || goalEntry.behaviorName || targetId,
      category: goalEntry.category,
      operationalDefinition: operationalDefinition || goalEntry.operationalDefinition,
      measurementType: measurementType || goalEntry.measurementType,
      masteryCriteria: masteryCriteria || goalEntry.defaultMasteryCriteria,
      status: act === 'REJECT' ? 'REJECTED' : act === 'MODIFY' ? 'SUGGESTED' : 'ACCEPTED',
    };

    // Upsert by (studentId, targetId): reuse the existing goal row if present
    const existing = await prisma.studentGoal.findFirst({
      where: { studentId: record.studentId, targetId },
    });
    if (existing) {
      await prisma.studentGoal.update({ where: { id: existing.id }, data });
    } else {
      await prisma.studentGoal.create({ data });
    }

    // ── One-click: accepted goal → active program target (Tier 3.14) ──
    // Reuses the student's first in-progress program, or creates one.
    let createdTarget: { id: string } | null = null;
    if (act === 'CREATE_TARGET') {
      let program = await prisma.program.findFirst({
        where: { studentId: record.studentId, status: 'IN_PROGRESS' },
        orderBy: { createdAt: 'asc' },
      });
      if (!program) {
        program = await prisma.program.create({
          data: {
            studentId: record.studentId,
            createdById: req.user.userId,
            name: goalEntry.category || 'New Learning Program',
            description: `Created from assessment goal suggestion (${targetId}).`,
          },
        });
      }
      // Avoid duplicating a skill that already exists in this program.
      const skillName = title || goalEntry.goalTitle || goalEntry.behaviorName || targetId;
      const dup = await prisma.target.findFirst({
        where: { programId: program.id, skill: skillName },
      });
      if (!dup) {
        createdTarget = await prisma.target.create({
          data: {
            programId: program.id,
            domain: goalEntry.category || 'Assessment',
            skill: skillName,
            masteryPercentage: 80,
            masteryConsecutive: 3,
          },
          select: { id: true },
        });
      }
    }

    const goals = await prisma.studentGoal.findMany({
      where: { studentId: record.studentId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ goals, createdTarget });
  } catch (error) {
    next(error);
  }
}

// ─── SOAP-style report draft for an assessment ──────────────────────────────
export async function getAssessmentReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const record = await prisma.assessmentRecord.findUnique({
      where: { id },
      include: {
        scores: true,
        assessor: { select: { id: true, name: true } },
        student: { select: { id: true, name: true, dateOfBirth: true } },
      },
    });
    if (!record || !req.user || !(await canAccessStudent(req.user, record.studentId))) {
      res.status(403).json({ error: 'You do not have access to this assessment' });
      return;
    }

    const agg = aggregateScores(record.assessmentType, record.scores);
    const deficits = detectDeficits(record.assessmentType, record.scores);

    const previousAttempts = await prisma.assessmentRecord.findMany({
      where: {
        studentId: record.studentId,
        assessmentType: record.assessmentType,
        attemptNumber: { lt: record.attemptNumber },
      },
      include: { scores: true },
      orderBy: { attemptNumber: 'desc' },
    });

    const { flags, changeVsPrevious } = evaluateAgainstPreviousAttempts(
      record.assessmentType,
      record.attemptNumber,
      record.scores,
      previousAttempts.map((p) => ({ attemptNumber: p.attemptNumber, scores: p.scores }))
    );

    const suggestedGoals = suggestGoals(record.assessmentType, record.scores, agg.domainTotals, 5);
    const reportText = generateSoapDraft(record.student.name, record.assessmentType, agg, flags, suggestedGoals);

    res.json({
      report: {
        assessmentId: record.id,
        student: record.student,
        assessor: record.assessor,
        assessmentType: record.assessmentType,
        attemptNumber: record.attemptNumber,
        createdAt: record.createdAt,
        evaluation: { ...agg, flags, changeVsPrevious, deficitCount: deficits.length },
        suggestedGoals,
        reportText,
      },
    });
  } catch (error) {
    next(error);
  }
}
