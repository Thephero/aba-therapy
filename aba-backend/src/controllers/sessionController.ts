import { prisma, containsInsensitive } from '../utils/prisma';
import { getSessionScope, getStudentScope, canAccessStudent, canAccessSession } from '../utils/access';
import { Request, Response, NextFunction } from 'express';

function normalizeSessionType(sessionType: any): string {
  // Accept either a single string (legacy) or an array of modalities (new UI).
  const modalities = Array.isArray(sessionType)
    ? sessionType
    : sessionType
      ? [sessionType]
      : ['DTT'];
  const cleaned = modalities.filter((m: any) => typeof m === 'string' && m.trim());
  return JSON.stringify(cleaned.length > 0 ? cleaned : ['DTT']);
}

export async function startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { studentId, sessionType, programIds, location, supervisorId } = body;
    const therapistId = req.user?.userId;
    if (!req.user || !studentId || !(await canAccessStudent(req.user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const session = await prisma.session.create({
      data: {
        studentId,
        therapistId: therapistId!,
        sessionType: normalizeSessionType(sessionType),
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
        student: { select: { id: true, name: true } },
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
    const { studentId, therapistId, sessionType, programIds, scheduledFor, supervisorId, location, recurrence } = body;

    if (!studentId || !therapistId || !scheduledFor) {
      res.status(400).json({ error: 'Student, therapist, and scheduled date/time are required' });
      return;
    }
    if (!req.user || !(await canAccessStudent(req.user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const commonData = {
      studentId,
      therapistId,
      sessionType: normalizeSessionType(sessionType),
      supervisorId: supervisorId || undefined,
      location,
    };

    // ── Recurring series (Tier 3.13) ──
    // recurrence: { weeks: 1..52 } — creates one SCHEDULED session per week
    // at the same time-of-day as the first occurrence. "Every Sunday & Tuesday
    // 4pm for 12 weeks" = schedule the first one, pass weeks: 12.
    const weeks = recurrence?.weeks ? parseInt(recurrence.weeks) : 1;
    if (weeks > 1) {
      const first = new Date(scheduledFor);
      const createdCount = Math.min(Math.max(weeks, 2), 52);
      const sessions = [];
      for (let i = 0; i < createdCount; i++) {
        const when = new Date(first.getTime() + i * 7 * 86_400_000);
        sessions.push(
          prisma.session.create({
            data: {
              ...commonData,
              status: 'SCHEDULED',
              scheduledFor: when,
              programs: {
                create: (programIds as string[])?.map((programId: string) => ({ programId })) || [],
              },
            },
            include: {
              programs: { include: { program: { include: { targets: true } } } },
              student: { select: { id: true, name: true } },
              therapist: { select: { id: true, name: true, email: true } },
              supervisor: { select: { id: true, name: true } },
            },
          })
        );
      }
      const created = await prisma.$transaction(sessions);
      res.status(201).json({ sessions: created, count: created.length });
      return;
    }

    const session = await prisma.session.create({
      data: {
        ...commonData,
        status: 'SCHEDULED',
        scheduledFor: new Date(scheduledFor),
        programs: {
          create: (programIds as string[])?.map((programId: string) => ({ programId })) || [],
        },
      },
      include: {
        programs: { include: { program: { include: { targets: true } } } },
        student: { select: { id: true, name: true } },
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

    if (!req.user || !(await canAccessSession(req.user, sessionId))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }

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
    if (!req.user || !(await canAccessSession(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: req.params.id as string },
      include: {
        student: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true, email: true } },
        programs: { include: { program: { include: { targets: true } } } },
        trials: { orderBy: { trialNumber: 'asc' } },
        behaviorRecords: { orderBy: { timestamp: 'desc' } },
        mandRecords: { orderBy: { timestamp: 'desc' } },
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
    if (!req.user || !(await canAccessSession(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }
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
    const { studentId, therapistId, status, type, centerId: queryCenterId, search } = req.query as Record<string, string>;
    const scope = await getSessionScope(req.user!);
    const where: any = { ...scope };

    if (req.user?.role === 'PARENT' && !studentId) {
      res.status(400).json({ error: 'studentId is required for parent session requests' });
      return;
    }

    if (studentId) {
      if (!req.user || !(await canAccessStudent(req.user, studentId))) {
        res.status(403).json({ error: 'You do not have access to this student' });
        return;
      }
      where.studentId = studentId;
    }
    if (therapistId) where.therapistId = therapistId;
    if (status) where.status = status;
    if (type === 'upcoming') where.status = 'SCHEDULED';

    // Text search across student/therapist/supervisor names, location, and status
    if (search) {
      where.AND = [
        {
          OR: [
            { student: { name: containsInsensitive(search) } },
            { therapist: { name: containsInsensitive(search) } },
            { supervisor: { name: containsInsensitive(search) } },
            { location: containsInsensitive(search) },
            { status: containsInsensitive(search) },
          ],
        },
      ];
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
    if (!req.user || !(await canAccessSession(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }
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
    if (!req.user || !(await canAccessSession(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }
    const body = req.body as Record<string, any>;
    let { behaviorPlanId, behaviorType, behaviorName, antecedent, behavior, consequence, frequency, durationSec, intensity, notes } = body;

    // If a behavior plan is chosen, the plan defines the data type and name —
    // the therapist should not be able to override either (supervisor-set).
    if (behaviorPlanId) {
      const plan = await prisma.behaviorPlan.findUnique({
        where: { id: behaviorPlanId as string },
        select: { id: true, name: true, dataType: true },
      });
      if (!plan) {
        res.status(400).json({ error: 'Behavior plan not found' });
        return;
      }
      behaviorName = plan.name;
      behaviorType = plan.dataType;
    }

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
        behaviorPlanId: behaviorPlanId || undefined,
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

// ─── Mands ──────────────────────────────────────────────────────────────────

export async function addMandRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !(await canAccessSession(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }
    const body = req.body as Record<string, any>;
    const { mandType, itemRequested, promptLevelUsed, independent, notes } = body;

    const record = await prisma.mandRecord.create({
      data: {
        sessionId: req.params.id as string,
        mandType: mandType || 'SPONTANEOUS',
        itemRequested: itemRequested || undefined,
        promptLevelUsed: promptLevelUsed || undefined,
        independent: independent === true,
        notes: notes || undefined,
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
    if (!req.user || !(await canAccessSession(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }
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
    if (!req.user || !(await canAccessSession(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }
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
    if (!req.user || !(await canAccessSession(req.user, req.params.id as string))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }
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

    const now = new Date();

    // Current period start
    let startDate: Date;
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

    // Previous period start (same length, immediately before the current one)
    let prevStartDate: Date;
    if (period === 'week') {
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 7);
    } else if (period === 'month') {
      prevStartDate = new Date(startDate);
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    } else {
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 1);
    }

    const studentScope = await getStudentScope(req.user!);
    const centerFilter = centerId ? { ...studentScope } : {};
    const sessionCenterFilter = centerId ? { student: studentScope } : {};

    async function computePeriod(start: Date, end?: Date) {
      // Range helper: [start, end) — end is optional (open-ended for the current period)
      const range = () => ({
        gte: start,
        ...(end ? { lt: end } : {}),
      } as Record<string, any>);

      const [sessionsToday, scheduledToday, periodSessions, periodTrials, periodBehaviors, newStudents, newStaff] = await Promise.all([
        // Sessions actually run in the period (completed or in-progress with a start time)
        prisma.session.count({
          where: {
            status: { in: ['COMPLETED', 'IN_PROGRESS'] },
            startedAt: range(),
            ...sessionCenterFilter,
          },
        }),
        // Sessions merely scheduled in the period (not yet run)
        prisma.session.count({
          where: {
            status: 'SCHEDULED',
            scheduledFor: range(),
            ...sessionCenterFilter,
          },
        }),
        // All sessions in period
        prisma.session.findMany({
          where: {
            OR: [
              { startedAt: range() },
              { scheduledFor: range() },
            ],
            ...sessionCenterFilter,
          },
          select: { id: true, status: true, startedAt: true, scheduledFor: true },
        }),
        // Trials count in period (via session relation)
        prisma.trial.count({
          where: { session: { startedAt: range(), ...sessionCenterFilter } },
        }),
        // Behavior records count in period
        prisma.behaviorRecord.count({
          where: { session: { startedAt: range(), ...sessionCenterFilter } },
        }),
        // New students created in period (for trend)
        prisma.student.count({ where: { ...centerFilter, createdAt: range() } }),
        // New staff created in period (for trend)
        prisma.user.count({ where: { ...centerFilter, createdAt: range() } }),
      ]);

      return {
        sessionsToday,
        scheduledToday,
        periodTotal: periodSessions.length,
        periodCompleted: periodSessions.filter((s) => s.status === 'COMPLETED').length,
        periodInProgress: periodSessions.filter((s) => s.status === 'IN_PROGRESS').length,
        periodTrials,
        periodBehaviors,
        newStudents,
        newStaff,
      };
    }

    const [current, previous, totalStudents, activeStudents, totalStaff, pendingNotes] = await Promise.all([
      computePeriod(startDate),
      computePeriod(prevStartDate, startDate), // previous window is [prevStart, start)
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
      // Staff count (center-wide, not scoped to the user's students)
      prisma.user.count({ where: { centerId, isActive: true } }),
      // Pending session notes for the current user: completed sessions they ran
      // (or that involve their students) where the SOAP note isn't finalized.
      prisma.session.count({
        where: {
          status: 'COMPLETED',
          ...(req.user?.role === 'THERAPIST'
            ? { therapistId: req.user.userId }
            : {}),
          ...sessionCenterFilter,
          OR: [{ soapNote: null }, { soapNote: { isFinalized: false } }],
        },
      }),
    ]);

    const pct = (cur: number, prev: number): number | null => {
      if (prev === 0) return cur === 0 ? 0 : null; // no previous baseline → no trend
      return Math.round(((cur - prev) / prev) * 100);
    };

    // ── Daily series (last 7 days) for sparklines ──────────────────────────
    const seriesStart = new Date(now);
    seriesStart.setDate(seriesStart.getDate() - 6);
    seriesStart.setHours(0, 0, 0, 0);

    const dayKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const [recentSessions, recentStudents, recentStaff, recentTrials, recentBehaviors] = await Promise.all([
      prisma.session.findMany({
        where: {
          OR: [{ startedAt: { gte: seriesStart } }, { scheduledFor: { gte: seriesStart, lte: now } }],
          ...sessionCenterFilter,
        },
        select: { id: true, status: true, startedAt: true, scheduledFor: true },
      }),
      prisma.student.findMany({ where: { ...centerFilter, createdAt: { gte: seriesStart } }, select: { createdAt: true } }),
      prisma.user.findMany({ where: { ...centerFilter, createdAt: { gte: seriesStart } }, select: { createdAt: true } }),
      prisma.trial.findMany({
        where: { session: { startedAt: { gte: seriesStart }, ...sessionCenterFilter } },
        select: { id: true, session: { select: { startedAt: true } } },
      }),
      prisma.behaviorRecord.findMany({
        where: { session: { startedAt: { gte: seriesStart }, ...sessionCenterFilter } },
        select: { id: true, session: { select: { startedAt: true } } },
      }),
    ]);

    const buckets: Record<string, { sessions: number; completed: number; inProgress: number; trials: number; behaviors: number; newStudents: number; newStaff: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(seriesStart);
      d.setDate(d.getDate() + i);
      buckets[dayKey(d)] = { sessions: 0, completed: 0, inProgress: 0, trials: 0, behaviors: 0, newStudents: 0, newStaff: 0 };
    }

    recentSessions.forEach((s) => {
      const key = s.startedAt ? dayKey(s.startedAt) : s.scheduledFor ? dayKey(s.scheduledFor) : null;
      if (!key || !buckets[key]) return;
      buckets[key].sessions += 1;
      if (s.status === 'COMPLETED') buckets[key].completed += 1;
      if (s.status === 'IN_PROGRESS') buckets[key].inProgress += 1;
    });
    recentTrials.forEach((t) => {
      const key = t.session.startedAt ? dayKey(t.session.startedAt) : null;
      if (key && buckets[key]) buckets[key].trials += 1;
    });
    recentBehaviors.forEach((b) => {
      const key = b.session.startedAt ? dayKey(b.session.startedAt) : null;
      if (key && buckets[key]) buckets[key].behaviors += 1;
    });
    recentStudents.forEach((s) => {
      const key = dayKey(s.createdAt);
      if (buckets[key]) buckets[key].newStudents += 1;
    });
    recentStaff.forEach((u) => {
      const key = dayKey(u.createdAt);
      if (buckets[key]) buckets[key].newStaff += 1;
    });

    const series = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    res.json({
      summary: {
        totalStudents,
        activeStudents,
        totalStaff,
        pendingNotes,
        sessionsToday: current.sessionsToday,
        scheduledToday: current.scheduledToday,
        periodCompleted: current.periodCompleted,
        periodInProgress: current.periodInProgress,
        periodTotal: current.periodTotal,
        periodTrials: current.periodTrials,
        periodBehaviors: current.periodBehaviors,
        period,
        trends: {
          sessionsToday: pct(current.sessionsToday, previous.sessionsToday),
          scheduledToday: pct(current.scheduledToday, previous.scheduledToday),
          periodCompleted: pct(current.periodCompleted, previous.periodCompleted),
          periodInProgress: pct(current.periodInProgress, previous.periodInProgress),
          periodTotal: pct(current.periodTotal, previous.periodTotal),
          periodTrials: pct(current.periodTrials, previous.periodTrials),
          periodBehaviors: pct(current.periodBehaviors, previous.periodBehaviors),
          newStudents: pct(current.newStudents, previous.newStudents),
          newStaff: pct(current.newStaff, previous.newStaff),
        },
        series,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Calendar Endpoint ──────────────────────────────────────────────────

export async function getCalendarSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { start, end, studentId } = req.query as Record<string, string>;
    const centerId = req.user?.centerId;

    if (!start || !end) {
      res.status(400).json({ error: 'start and end query params are required (ISO date strings)' });
      return;
    }

    const studentScope = await getSessionScope(req.user!);
    const where: any = {
      ...studentScope,
      OR: [
        { scheduledFor: { gte: new Date(start), lte: new Date(end) } },
        { startedAt: { gte: new Date(start), lte: new Date(end) } },
      ],
    };
    if (req.user?.role === 'PARENT' && !studentId) {
      res.status(400).json({ error: 'studentId is required for parent calendar requests' });
      return;
    }
    if (studentId) {
      if (!req.user || !(await canAccessStudent(req.user, studentId))) {
        res.status(403).json({ error: 'You do not have access to this student' });
        return;
      }
      where.studentId = studentId;
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
    if (!req.user || !(await canAccessSession(req.user, sessionId))) {
      res.status(403).json({ error: 'You do not have access to this session' });
      return;
    }

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
