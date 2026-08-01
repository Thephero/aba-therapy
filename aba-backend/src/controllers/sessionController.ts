import { prisma } from '../utils/prisma';
import { Request, Response, NextFunction } from 'express';

export async function startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { studentId, sessionType, programIds, location, supervisorId } = body;
    const therapistId = req.user?.userId;

    const session = await prisma.session.create({
      data: {
        studentId,
        therapistId: therapistId!,
        sessionType: sessionType || 'DTT',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        supervisorId: supervisorId || undefined,
        location,
        programs: {
          create: (programIds as string[])?.map((programId: string) => ({ programId })) || [],
        },
      },
      include: {
        programs: { include: { program: { include: { targets: true } } } },
        student: true,
      },
    });

    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
}

export async function scheduleSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { studentId, therapistId, sessionType, programIds, scheduledFor, supervisorId, location } = body;

    if (!studentId || !therapistId || !scheduledFor) {
      res.status(400).json({ error: 'Student, therapist, and scheduled date/time are required' });
      return;
    }

    const session = await prisma.session.create({
      data: {
        studentId,
        therapistId,
        sessionType: sessionType || 'DTT',
        status: 'SCHEDULED',
        scheduledFor: new Date(scheduledFor),
        supervisorId: supervisorId || undefined,
        location,
        programs: {
          create: (programIds as string[])?.map((programId: string) => ({ programId })) || [],
        },
      },
      include: {
        programs: { include: { program: { include: { targets: true } } } },
        student: true,
        therapist: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
}

export async function beginScheduledSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.params.id as string;

    const existing = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });

    if (!existing || existing.status !== 'SCHEDULED') {
      res.status(400).json({ error: 'Only SCHEDULED sessions can be started' });
      return;
    }

    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    res.json({ session });
  } catch (error) {
    next(error);
  }
}

export async function getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id as string },
      include: {
        student: true,
        therapist: { select: { id: true, name: true, email: true } },
        programs: { include: { program: { include: { targets: true } } } },
        trials: { orderBy: { trialNumber: 'asc' } },
        behaviorRecords: { orderBy: { timestamp: 'desc' } },
        preferenceAssessments: { orderBy: { timestamp: 'desc' } },
        reinforcerChecks: { orderBy: { timestamp: 'desc' } },
        alerts: { orderBy: { createdAt: 'desc' } },
        soapNote: true,
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ session });
  } catch (error) {
    next(error);
  }
}

export async function endSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await prisma.session.update({
      where: { id: req.params.id as string },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    res.json({ session });
  } catch (error) {
    next(error);
  }
}

export async function listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentId, therapistId, status, type, centerId: queryCenterId } = req.query as Record<string, string>;
    const where: any = {};

    if (studentId) where.studentId = studentId;
    if (therapistId) where.therapistId = therapistId;
    if (status) where.status = status;
    if (type === 'upcoming') where.status = 'SCHEDULED';

    // Center-level filter for admins
    if (req.user?.role === 'CENTER_ADMIN' && !studentId && !therapistId) {
      where.student = { centerId: req.user.centerId };
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        student: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
        _count: { select: { trials: true, behaviorRecords: true } },
        soapNote: { select: { id: true, isFinalized: true, coSignedById: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}

// ─── Trials ─────────────────────────────────────────────────────────────────

export async function addTrial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    let { targetId, trialType, trialNumber, response, promptLevelUsed, correct, notes } = body;

    // Fix: skip targetId if empty to avoid FK violation
    if (!targetId || targetId === '') targetId = undefined;
    // Fix: response is String? in schema, keep as string or undefined
    if (response === '' || response === undefined) response = undefined;
    // Fix: correct is Boolean? in schema
    if (correct === '' || correct === undefined) correct = undefined;
    // Fix: promptLevelUsed should be null if empty string
    if (promptLevelUsed === '') promptLevelUsed = undefined;

    const trial = await prisma.trial.create({
      data: {
        sessionId: req.params.id as string,
        targetId,
        trialType: trialType || 'DTT',
        trialNumber: parseInt(trialNumber) || 1,
        response,
        promptLevelUsed: promptLevelUsed as string,
        correct,
        notes: notes || undefined,
      },
    });

    res.status(201).json({ trial });
  } catch (error) {
    next(error);
  }
}

// ─── Behavior Records ───────────────────────────────────────────────────────

export async function addBehaviorRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    let { behaviorType, behaviorName, antecedent, behavior, consequence, frequency, durationSec, intensity, notes } = body;

    // Fix: intensity is String? in schema, convert number to string
    if (intensity !== undefined && intensity !== null) {
      intensity = String(intensity);
    }
    // Fix: ensure empty strings become undefined for optional String? fields
    if (antecedent === '') antecedent = undefined;
    if (behavior === '') behavior = undefined;
    if (consequence === '') consequence = undefined;
    if (notes === '') notes = undefined;
    if (!behaviorName) {
      res.status(400).json({ error: 'Behavior name is required' });
      return;
    }

    const record = await prisma.behaviorRecord.create({
      data: {
        sessionId: req.params.id as string,
        behaviorType,
        behaviorName,
        antecedent,
        behavior,
        consequence,
        frequency: behaviorType === 'FREQUENCY' ? (parseInt(frequency) || 1) : null,
        durationSec: behaviorType === 'DURATION' ? (parseInt(durationSec) || 30) : null,
        intensity,
        notes,
      },
    });

    res.status(201).json({ record });
  } catch (error) {
    next(error);
  }
}

// ─── Preference Assessments ─────────────────────────────────────────────────

export async function addPreferenceAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { method, itemsOffered, selectedItem, rankings, notes } = body;

    const assessment = await prisma.preferenceAssessment.create({
      data: {
        sessionId: req.params.id as string,
        method,
        itemsOffered: Array.isArray(itemsOffered) ? JSON.stringify(itemsOffered) : itemsOffered,
        selectedItem,
        rankings: rankings ? JSON.stringify(rankings) : undefined,
        notes,
      },
    });

    res.status(201).json({ assessment });
  } catch (error) {
    next(error);
  }
}

// ─── Reinforcer Checks ──────────────────────────────────────────────────────

export async function addReinforcerCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { reinforcerUsed, effectivenessRating, notes } = body;

    const check = await prisma.reinforcerCheck.create({
      data: {
        sessionId: req.params.id as string,
        reinforcerUsed,
        effectivenessRating,
        notes,
      },
    });

    res.status(201).json({ check });
  } catch (error) {
    next(error);
  }
}

// ─── SOAP Notes ─────────────────────────────────────────────────────────────

export async function saveSOAPNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const sessionId = req.params.id as string;
    const { subjective, objective, assessment, plan, isFinalized } = body;

    const soapNote = await prisma.sOAPNote.upsert({
      where: { sessionId },
      update: {
        subjective,
        objective,
        assessment,
        plan,
        autoDrafted: false,
        ...(isFinalized && { isFinalized: true }),
      },
      create: {
        sessionId,
        subjective,
        objective,
        assessment,
        plan,
        autoDrafted: false,
        ...(isFinalized && { isFinalized: true }),
      },
    });

    res.json({ soapNote });
  } catch (error) {
    next(error);
  }
}

// ─── Dashboard Summary ────────────────────────────────────────────────────

export async function getDashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const period = (req.query.period as string) || 'today';
    const centerId = req.user?.centerId;

    let startDate: Date;
    const now = new Date();

    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      // today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const centerFilter = centerId ? { centerId } : {};
    const sessionCenterFilter = centerId ? { student: { centerId } } : {};
    const timeWhere = {
      startedAt: { gte: startDate },
      ...sessionCenterFilter,
    };

    const [
      totalStudents,
      activeStudents,
      totalStaff,
      sessionsToday,
      allPeriodSessions,
      periodTrials,
      periodBehaviors,
    ] = await Promise.all([
      // Total students in center
      prisma.student.count({ where: { ...centerFilter, isActive: true } }),
      // Students with sessions today
      prisma.student.count({
        where: {
          ...centerFilter,
          isActive: true,
          sessions: {
            some: {
              status: 'IN_PROGRESS',
              startedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
            },
          },
        },
      }),
      // Staff count
      prisma.user.count({ where: { ...centerFilter, isActive: true } }),
      // Sessions today (active and scheduled)
      prisma.session.count({
        where: {
          OR: [
            { status: 'IN_PROGRESS', startedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
            { status: 'SCHEDULED', scheduledFor: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
          ],
          ...sessionCenterFilter,
        },
      }),
      // All sessions in period
      prisma.session.findMany({
        where: {
          OR: [
            { startedAt: { gte: startDate } },
            { scheduledFor: { gte: startDate } },
          ],
          ...sessionCenterFilter,
        },
        select: { id: true, status: true, startedAt: true, scheduledFor: true },
        orderBy: { startedAt: { sort: 'desc', nulls: 'last' } },
      }),
      // Trials count in period (via session relation)
      prisma.trial.count({
        where: {
          session: { startedAt: { gte: startDate }, ...sessionCenterFilter },
        },
      }),
      // Behavior records count in period
      prisma.behaviorRecord.count({
        where: {
          session: { startedAt: { gte: startDate }, ...sessionCenterFilter },
        },
      }),
    ]);

    const completedSessions = allPeriodSessions.filter(s => s.status === 'COMPLETED').length;
    const inProgressSessions = allPeriodSessions.filter(s => s.status === 'IN_PROGRESS').length;

    res.json({
      summary: {
        totalStudents,
        activeStudents,
        totalStaff,
        sessionsToday,
        periodCompleted: completedSessions,
        periodInProgress: inProgressSessions,
        periodTotal: allPeriodSessions.length,
        periodTrials,
        periodBehaviors,
        period,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Calendar Endpoint ──────────────────────────────────────────────────

export async function getCalendarSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { start, end } = req.query as Record<string, string>;
    const centerId = req.user?.centerId;

    if (!start || !end) {
      res.status(400).json({ error: 'start and end query params are required (ISO date strings)' });
      return;
    }

    const where: any = {
      OR: [
        { scheduledFor: { gte: new Date(start), lte: new Date(end) } },
        { startedAt: { gte: new Date(start), lte: new Date(end) } },
      ],
    };

    // Center-level filter for admins
    if (req.user?.role === 'CENTER_ADMIN' && !req.query.studentId) {
      where.student = { centerId: req.user.centerId };
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        student: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
        _count: { select: { trials: true, behaviorRecords: true } },
        soapNote: { select: { id: true, isFinalized: true } },
      },
      orderBy: [{ scheduledFor: { sort: 'asc', nulls: 'last' } }, { startedAt: { sort: 'asc', nulls: 'last' } }],
    });

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}

export async function coSignSOAPNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.params.id as string;
    const userId = req.user?.userId;

    const soapNote = await prisma.sOAPNote.update({
      where: { sessionId },
      data: {
        isFinalized: true,
        coSignedById: userId!,
        coSignedAt: new Date(),
      },
    });

    res.json({ soapNote });
  } catch (error) {
    next(error);
  }
}
