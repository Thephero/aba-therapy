import { prisma } from '../utils/prisma';
import { canAccessStudent, getStudentScope } from '../utils/access';
import { Request, Response, NextFunction } from 'express';

// ─── Attendance + per-session parent invoicing ─────────────────────────────
// Uses the existing AttendanceRecord model. Each COMPLETED session can be
// marked attended/missed; each attended session accumulates into a simple
// per-student balance ("sessions owed") that admins/parents can see.

const ATTENDANCE_STATUSES = ['ATTENDING', 'ABSENT', 'SICK', 'LATE', 'OTHER'] as const;

export async function listAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const { studentId, from, to } = req.query as Record<string, string>;

    let where: any = {};
    if (user.role === 'CENTER_ADMIN' || user.role === 'SUPERVISOR' || user.role === 'THERAPIST') {
      where = { student: await getStudentScope(user) };
    } else {
      // Parents only see their own children
      where = { student: { parentId: user.userId } };
      if (studentId) {
        const ok = await canAccessStudent(user, studentId);
        if (!ok) {
          res.status(403).json({ error: 'You do not have access to this student' });
          return;
        }
        where.studentId = studentId;
      }
    }

    if (studentId && user.role !== 'PARENT') where.studentId = studentId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        student: { select: { id: true, name: true } },
        markedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 500,
    });

    res.json({ records });
  } catch (error) {
    next(error);
  }
}

export async function markAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    if (!user || (user.role !== 'CENTER_ADMIN' && user.role !== 'SUPERVISOR' && user.role !== 'THERAPIST')) {
      res.status(403).json({ error: 'Only staff can mark attendance' });
      return;
    }

    const body = req.body as Record<string, any>;
    const { studentId, date, status, notes } = body;

    if (!studentId || !(await canAccessStudent(user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }
    if (!status || !ATTENDANCE_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${ATTENDANCE_STATUSES.join(', ')}` });
      return;
    }

    const recordDate = date ? new Date(date) : new Date();
    // One record per student per day (replace any existing mark for that day)
    const startOfDay = new Date(recordDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(recordDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.attendanceRecord.findFirst({
      where: { studentId, date: { gte: startOfDay, lte: endOfDay } },
    });

    let record;
    if (existing) {
      record = await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { status, notes: notes ?? existing.notes, markedById: user.userId },
      });
    } else {
      record = await prisma.attendanceRecord.create({
        data: {
          studentId,
          date: recordDate,
          status,
          notes: notes || undefined,
          markedById: user.userId,
        },
      });
    }

    // Notify the parent in the student's chat thread (shows as an unread
    // message for them — the messages page is the parent notification feed).
    // (markAttendance is staff-only already, so this always applies here.)
    {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { name: true, parentId: true },
      });
      if (student?.parentId) {
        const fmt = recordDate.toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        });
        await prisma.message.create({
          data: {
            studentId,
            senderId: user.userId,
            receiverId: student.parentId,
            content: `📋 Attendance update for ${student.name} — marked ${status.toLowerCase()} on ${fmt}${notes ? `. Note: ${notes}` : ''}`,
          },
        });
      }
    }

    res.status(201).json({ record });
  } catch (error) {
    next(error);
  }
}

export async function deleteAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    if (!user || user.role !== 'CENTER_ADMIN') {
      res.status(403).json({ error: 'Only center admins can delete attendance records' });
      return;
    }
    await prisma.attendanceRecord.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Attendance record deleted' });
  } catch (error) {
    next(error);
  }
}

// ─── Invoicing: simple per-session balance ─────────────────────────────────
// Each attended session = 1 billable session at the student's center rate.
// Parents see read-only totals; admins see and can adjust rates.

export async function getBillingSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const { studentId } = req.query as Record<string, string>;

    const sessionRate = parseFloat(process.env.SESSION_RATE_AED || '0') || 0;

    interface StudentBilling {
      studentId: string;
      studentName: string;
      attendedSessions: number;
      missedSessions: number;
      amountOwed: number;
      currency: string;
    }

    let scope: Record<string, any> = {};
    if (user.role === 'PARENT') {
      scope = { parentId: user.userId, isActive: true };
      if (studentId) {
        const ok = await canAccessStudent(user, studentId);
        if (!ok) {
          res.status(403).json({ error: 'You do not have access to this student' });
          return;
        }
        scope.id = studentId;
      }
    } else {
      const studentScope = await getStudentScope(user);
      if (studentId) {
        const ok = await canAccessStudent(user, studentId);
        if (!ok) {
          res.status(403).json({ error: 'You do not have access to this student' });
          return;
        }
        scope = { ...studentScope, id: studentId };
      } else {
        scope = studentScope;
      }
    }

    const students = await prisma.student.findMany({
      where: scope,
      select: { id: true, name: true },
    });

    const billing: StudentBilling[] = await Promise.all(
      students.map(async (student) => {
        const [attended, missed] = await Promise.all([
          prisma.attendanceRecord.count({
            where: { studentId: student.id, status: { in: ['ATTENDING', 'LATE'] } },
          }),
          prisma.attendanceRecord.count({
            where: { studentId: student.id, status: { in: ['ABSENT', 'SICK', 'OTHER'] } },
          }),
        ]);
        return {
          studentId: student.id,
          studentName: student.name,
          attendedSessions: attended,
          missedSessions: missed,
          amountOwed: attended * sessionRate,
          currency: 'AED',
        };
      })
    );

    res.json({
      sessionRate,
      currency: 'AED',
      billing,
      note: sessionRate
        ? undefined
        : 'Set SESSION_RATE_AED env var to enable amount calculations; session counts are shown meanwhile.',
    });
  } catch (error) {
    next(error);
  }
}
