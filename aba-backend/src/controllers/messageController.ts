import { prisma } from '../utils/prisma';
import { canAccessStudent } from '../utils/access';
import { Request, Response, NextFunction } from 'express';

// ─── In-app messaging (per student) ──────────────────────────────────────
// Uses the existing Message model: parent(s), therapist(s) and supervisor(s)
// of a student can all see and write in that student's thread. Center admins
// can join any thread in their center.

/**
 * Who else can see a thread for this student?
 * Parents see their own children's threads; staff see threads for their
 * assigned students; admins see everything in their center.
 */
async function buildThreadScope(req: Request, studentId: string): Promise<Record<string, any> | null> {
  const user = req.user!;
  return { studentId };
}

export async function listThreads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Threads = students the user can access, with last message + unread count.
    let studentIds: string[] | null = null; // null = whole center (admins)
    if (user.role === 'PARENT') {
      const rows = await prisma.student.findMany({
        where: { parentId: user.userId, isActive: true },
        select: { id: true },
      });
      studentIds = rows.map((r) => r.id);
    } else if (user.role === 'SUPERVISOR') {
      const rows = await prisma.studentSupervisor.findMany({
        where: { supervisorId: user.userId },
        select: { studentId: true },
      });
      studentIds = rows.map((r) => r.studentId);
    } else if (user.role === 'THERAPIST') {
      const rows = await prisma.studentTherapist.findMany({
        where: { therapistId: user.userId },
        select: { studentId: true },
      });
      studentIds = rows.map((r) => r.studentId);
    } else if (user.role === 'CENTER_ADMIN') {
      const rows = await prisma.student.findMany({
        where: { centerId: user.centerId, isActive: true },
        select: { id: true },
      });
      studentIds = rows.map((r) => r.id);
    }

    if (!studentIds || studentIds.length === 0) {
      res.json({ threads: [] });
      return;
    }

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true, profileImageUrl: true },
    });

    const threads = await Promise.all(
      students.map(async (student) => {
        const [lastMessage, unreadCount, messageCount] = await Promise.all([
          prisma.message.findFirst({
            where: { studentId: student.id },
            orderBy: { createdAt: 'desc' },
            include: {
              sender: { select: { id: true, name: true, role: true } },
            },
          }),
          prisma.message.count({
            where: {
              studentId: student.id,
              receiverId: user.userId,
              isRead: false,
            },
          }),
          prisma.message.count({ where: { studentId: student.id } }),
        ]);

        return {
          studentId: student.id,
          studentName: student.name,
          profileImageUrl: student.profileImageUrl,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                senderName: lastMessage.sender.name,
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
                isMine: lastMessage.senderId === user.userId,
              }
            : null,
          unreadCount,
          messageCount,
        };
      })
    );

    // Sort: most recent activity first, then by name.
    threads.sort((a: any, b: any) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    res.json({ threads });
  } catch (error) {
    next(error);
  }
}

export async function getThread(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const studentId = req.params.studentId as string;

    if (!user || !(await canAccessStudent(user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this conversation' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    // Participants: parent(s), therapists, supervisors assigned to this student.
    const [student, therapists, supervisors] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, name: true, parentId: true },
      }),
      prisma.studentTherapist.findMany({
        where: { studentId },
        include: { therapist: { select: { id: true, name: true, role: true, isActive: true } } },
      }),
      prisma.studentSupervisor.findMany({
        where: { studentId },
        include: { supervisor: { select: { id: true, name: true, role: true, isActive: true } } },
      }),
    ]);

    interface Participant {
      id: string;
      name: string;
      role: string;
    }
    const participants = new Map<string, Participant>();
    therapists.forEach((t) => {
      participants.set(t.therapist.id, {
        id: t.therapist.id,
        name: t.therapist.name,
        role: t.therapist.role,
      });
    });
    supervisors.forEach((s) => {
      participants.set(s.supervisor.id, {
        id: s.supervisor.id,
        name: s.supervisor.name,
        role: s.supervisor.role,
      });
    });

    // Everyone else who participates in the thread (previous senders)
    messages.forEach((m: any) => {
      if (!participants.has(m.senderId)) {
        participants.set(m.senderId, {
          id: m.sender.id,
          name: m.sender.name,
          role: m.sender.role,
        });
      }
    });

    // Mark the other side's messages to me as read.
    await prisma.message.updateMany({
      where: { studentId, receiverId: user.userId, isRead: false },
      data: { isRead: true },
    });

    res.json({
      student,
      messages: messages.map((m: any) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.sender.name,
        senderRole: m.sender.role,
        isMine: m.senderId === user.userId,
        isRead: m.isRead,
        createdAt: m.createdAt,
      })),
      participants: Array.from(participants.values()),
    });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const studentId = req.params.studentId as string;
    const { content, broadcast } = req.body as Record<string, any>;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    if (!user || !(await canAccessStudent(user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this conversation' });
      return;
    }

    // CENTER_ADMIN shared announcement: post the same message into every
    // student's chat in the center ("send to all"). The selected studentId
    // is only used for the access check up here.
    if (broadcast === true) {
      if (user.role !== 'CENTER_ADMIN') {
        res.status(403).json({ error: 'Only center admins can broadcast' });
        return;
      }
      const students = await prisma.student.findMany({
        where: { centerId: user.centerId, isActive: true },
        select: { id: true, parentId: true },
      });
      if (students.length > 0) {
        await prisma.message.createMany({
          data: students.map((s) => ({
            studentId: s.id,
            senderId: user.userId,
            // Address the copy to that child's parent so it shows as an
            // unread badge for them (staff still see it in the thread);
            // fall back to the admin's own id when a student has no parent.
            receiverId: s.parentId || user.userId,
            content: content.trim().slice(0, 4000),
          })),
        });
      }
      res.status(201).json({ broadcastTo: students.length });
      return;
    }

    const message = await prisma.message.create({
      data: {
        studentId,
        senderId: user.userId,
        receiverId: user.userId, // Thread-style: everyone in the thread sees it.
        content: content.trim().slice(0, 4000),
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    res.status(201).json({
      message: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderName: message.sender.name,
        senderRole: message.sender.role,
        isMine: true,
        isRead: true,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const count = await prisma.message.count({
      where: {
        receiverId: user.userId,
        senderId: { not: user.userId },
        isRead: false,
      },
    });

    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
}
