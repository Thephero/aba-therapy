import { prisma } from '../utils/prisma';
import { getStudentScope } from '../utils/access';
import { Request, Response, NextFunction } from 'express';

// ─── Supervisor lookout: risk overview + co-sign queue ──────────────────────
// One endpoint answering Omar's daily question: "which of my students
// needs attention THIS week?"

export async function getSupervisorOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const scope = await getStudentScope(user);

    const students = await prisma.student.findMany({
      where: scope,
      select: { id: true, name: true },
    });
    const studentIds = students.map((s) => s.id);

    if (studentIds.length === 0) {
      res.json({ students: [], cosignQueue: [], totals: { pendingCosign: 0, atRisk: 0 } });
      return;
    }

    const CO_SIGN_STALE_DAYS = 5;
    const cosignCutoff = new Date(Date.now() - CO_SIGN_STALE_DAYS * 86_400_000);

    // ── Co-sign queue: finalized-but-unsigned notes (or unfinalized drafts) ──
    const cosignNotes = await prisma.sOAPNote.findMany({
      where: {
        session: { studentId: { in: studentIds }, status: 'COMPLETED' },
        isFinalized: false,
      },
      include: {
        session: {
          select: {
            id: true,
            endedAt: true,
            startedAt: true,
            therapist: { select: { id: true, name: true } },
            student: { select: { id: true, name: true } },
            _count: { select: { trials: true } },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    const cosignQueue = cosignNotes.map((n) => {
      const endedAt = n.session.endedAt || n.session.startedAt || n.updatedAt;
      const ageDays = endedAt ? Math.floor((Date.now() - endedAt.getTime()) / 86_400_000) : null;
      return {
        sessionId: n.session.id,
        studentId: n.session.student.id,
        studentName: n.session.student.name,
        therapistName: n.session.therapist.name,
        endedAt,
        ageDays,
        trials: n.session._count.trials,
        isDraft: !n.objective && !n.assessment,
        stale: ageDays != null && ageDays >= CO_SIGN_STALE_DAYS,
      };
    });

    // ── Risk signals per student ──
    const riskRows = await Promise.all(
      students.map(async (student) => {
        const signals: string[] = [];
        let riskScore = 0;

        // 1. Accuracy drop: current week vs previous week per target
        const weekAgo = new Date(Date.now() - 7 * 86_400_000);
        const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000);

        const thisWeek = await prisma.trial.findMany({
          where: {
            session: { studentId: student.id, startedAt: { gte: weekAgo }, status: 'COMPLETED' },
            correct: { not: null },
          },
          select: { correct: true, targetId: true },
        });
        const lastWeek = await prisma.trial.findMany({
          where: {
            session: { studentId: student.id, startedAt: { gte: twoWeeksAgo, lt: weekAgo }, status: 'COMPLETED' },
            correct: { not: null },
          },
          select: { correct: true },
        });

        const acc = (rows: { correct: boolean | null }[]) =>
          rows.length ? rows.filter((r) => r.correct).length / rows.length : null;
        const thisAcc = acc(thisWeek);
        const prevAcc = acc(lastWeek);
        if (thisAcc !== null && prevAcc !== null && prevAcc - thisAcc >= 0.2) {
          signals.push(`Accuracy dropped ${Math.round((prevAcc - thisAcc) * 100)}% vs last week`);
          riskScore += 2;
        }

        // 2. Stalling targets: no trial data on an active target in 14+ days
        const activeTargets = await prisma.target.findMany({
          where: { program: { studentId: student.id }, status: 'IN_PROGRESS' },
          select: { id: true, skill: true },
        });
        for (const target of activeTargets) {
          const lastTrial = await prisma.trial.findFirst({
            where: { targetId: target.id },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true },
          });
          const staleDays = lastTrial
            ? Math.floor((Date.now() - lastTrial.timestamp.getTime()) / 86_400_000)
            : null;
          if (staleDays === null || staleDays >= 14) {
            signals.push(`No data on "${target.skill}" for ${staleDays === null ? 'a while' : `${staleDays} days`}`);
            riskScore += 1;
          }
        }

        // 3. Overdue notes (not finalized 3+ days after session end)
        const staleNotes = cosignQueue.filter(
          (n) => n.studentId === student.id && n.ageDays != null && n.ageDays >= 3
        );
        if (staleNotes.length > 0) {
          signals.push(`${staleNotes.length} session note${staleNotes.length > 1 ? 's' : ''} not finalized (3+ days old)`);
          riskScore += staleNotes.length;
        }

        return {
          studentId: student.id,
          studentName: student.name,
          signals,
          riskScore,
          thisWeekAccuracy: thisAcc != null ? Math.round(thisAcc * 100) : null,
          lastWeekAccuracy: prevAcc != null ? Math.round(prevAcc * 100) : null,
          pendingCosign: cosignQueue.filter((n) => n.studentId === student.id).length,
        };
      })
    );

    // Sort: highest risk first
    riskRows.sort((a: any, b: any) => b.riskScore - a.riskScore || a.studentName.localeCompare(b.studentName));

    res.json({
      students: riskRows,
      cosignQueue,
      totals: {
        pendingCosign: cosignQueue.length,
        atRisk: riskRows.filter((r: any) => r.riskScore > 0).length,
      },
    });
  } catch (error) {
    next(error);
  }
}
