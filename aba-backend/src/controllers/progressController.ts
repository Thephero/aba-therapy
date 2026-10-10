import { prisma } from '../utils/prisma';
import { canAccessStudent } from '../utils/access';
import { Request, Response, NextFunction } from 'express';

// ─── Skill progress per program (parent view + report data) ────────────────
// For each target: correct rate at the start vs recent sessions, mastery
// status, and a plain-language sentence. Powers the parent "Skill progress"
// view and the printable progress report.

export async function getStudentSkillProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const studentId = req.params.studentId as string;

    if (!user || !(await canAccessStudent(user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }

    const programs = await prisma.program.findMany({
      where: { studentId, status: { not: 'ON_HOLD' } },
      include: {
        targets: {
          include: {
            trials: {
              include: { session: { select: { status: true, startedAt: true } } },
              where: { correct: { not: null } },
              orderBy: { timestamp: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    interface TargetProgress {
      targetId: string;
      skill: string;
      domain: string;
      status: string;
      masteredAt?: string;
      firstAccuracy: number | null;
      latestAccuracy: number | null;
      totalTrials: number;
      trend: 'improving' | 'steady' | 'dropping' | 'new';
      parentSummary: string;
    }

    interface ProgramProgress {
      programId: string;
      name: string;
      status: string;
      targets: TargetProgress[];
    }

    const result: ProgramProgress[] = programs.map((program) => {
      const targets: TargetProgress[] = program.targets.map((target) => {
        const scoredTrials = target.trials.filter((t) => t.session.status === 'COMPLETED');
        const total = scoredTrials.length;

        // First-session accuracy vs most-recent-session accuracy
        const firstSessionDate = scoredTrials.length > 0 ? scoredTrials[0].timestamp : null;
        const firstSessionTrials = firstSessionDate
          ? scoredTrials.filter(
              (t) => t.timestamp.getTime() - firstSessionDate.getTime() < 6 * 60 * 60 * 1000 // same day-ish
            )
          : [];
        const latestDate = scoredTrials.length > 0 ? scoredTrials[scoredTrials.length - 1].timestamp : null;
        const latestSessionTrials = latestDate
          ? scoredTrials.filter(
              (t) =>
                t.timestamp.getTime() > latestDate.getTime() - 6 * 60 * 60 * 1000 &&
                latestDate.getTime() - t.timestamp.getTime() < 6 * 60 * 60 * 1000
            )
          : [];

        const rate = (rows: typeof scoredTrials) =>
          rows.length ? Math.round((rows.filter((t) => t.correct).length / rows.length) * 100) : null;

        const firstAccuracy = firstSessionTrials.length >= 3 ? rate(firstSessionTrials) : null;
        const latestAccuracy = latestSessionTrials.length >= 3 ? rate(latestSessionTrials) : null;

        let trend: TargetProgress['trend'] = 'new';
        if (firstAccuracy !== null && latestAccuracy !== null) {
          const delta = latestAccuracy - firstAccuracy;
          trend = delta >= 10 ? 'improving' : delta <= -10 ? 'dropping' : 'steady';
        }

        // Plain-language sentence
        let parentSummary: string;
        if (target.status === 'MASTERED') {
          parentSummary = `Learned and checked off — great progress on this skill!`;
        } else if (latestAccuracy === null && firstAccuracy === null) {
          parentSummary = 'Just started — not enough practice yet to show progress.';
        } else if (trend === 'improving') {
          parentSummary = `Getting it right ${latestAccuracy}% of the time, up from ${firstAccuracy}% when this started.`;
        } else if (trend === 'dropping') {
          parentSummary = `Right about ${latestAccuracy}% of the time recently (was ${firstAccuracy}%). The team is watching this one.`;
        } else if (trend === 'steady') {
          parentSummary = `Consistently right about ${latestAccuracy}% of the time. Steady practice.`;
        } else {
          parentSummary = latestAccuracy !== null
            ? `Right about ${latestAccuracy}% of the time so far.`
            : 'Building up practice on this skill.';
        }

        return {
          targetId: target.id,
          skill: target.skill,
          domain: target.domain,
          status: target.status,
          masteredAt: target.masteredAt?.toISOString(),
          firstAccuracy,
          latestAccuracy,
          totalTrials: total,
          trend,
          parentSummary,
        };
      });

      return {
        programId: program.id,
        name: program.name,
        status: program.status,
        targets,
      };
    });

    res.json({ programs: result });
  } catch (error) {
    next(error);
  }
}
