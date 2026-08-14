import { prisma } from './prisma';
import { TokenPayload } from './jwt';

/**
 * Returns the IDs of students a user is allowed to see, or `null` for
 * CENTER_ADMIN (all students in the center).
 *
 * - CENTER_ADMIN → null (whole center)
 * - SUPERVISOR   → students in their StudentSupervisor assignments
 * - THERAPIST    → students in their StudentTherapist assignments
 * - PARENT       → students linked via Student.parentId
 */
export async function getVisibleStudentIds(user: TokenPayload): Promise<string[] | null> {
  if (user.role === 'CENTER_ADMIN') return null;

  if (user.role === 'SUPERVISOR') {
    const rows = await prisma.studentSupervisor.findMany({
      where: { supervisorId: user.userId },
      select: { studentId: true },
    });
    return rows.map((r) => r.studentId);
  }

  if (user.role === 'THERAPIST') {
    const rows = await prisma.studentTherapist.findMany({
      where: { therapistId: user.userId },
      select: { studentId: true },
    });
    return rows.map((r) => r.studentId);
  }

  if (user.role === 'PARENT') {
    const rows = await prisma.student.findMany({
      where: { parentId: user.userId, isActive: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  return [];
}

/**
 * Builds a Prisma `where` fragment for scoping Student queries.
 * Returns an empty-ish object for admins (whole center) or `{ id: { in: [...] } }`
 * for everyone else. `centerId` is always enforced for non-admins.
 */
export async function getStudentScope(user: TokenPayload): Promise<Record<string, any>> {
  const centerId = user.centerId;
  const visibleIds = await getVisibleStudentIds(user);

  if (user.role === 'CENTER_ADMIN') {
    return { centerId };
  }

  return { centerId, id: { in: visibleIds ?? [] } };
}

/**
 * Builds a Prisma `where` fragment for scoping Session queries via the
 * student relation (e.g. `{ student: { centerId, id: { in } } }`).
 */
export async function getSessionScope(user: TokenPayload): Promise<Record<string, any>> {
  const centerId = user.centerId;
  const visibleIds = await getVisibleStudentIds(user);

  if (user.role === 'CENTER_ADMIN') {
    return { student: { centerId } };
  }

  return { student: { centerId, id: { in: visibleIds ?? [] } } };
}

/**
 * Checks whether a user may view a given student.
 * Throws nothing — returns boolean.
 */
export async function canAccessStudent(user: TokenPayload, studentId: string): Promise<boolean> {
  const scope = await getStudentScope(user);
  // Note: do NOT spread `scope` next to `id: studentId` — scope.id would
  // overwrite the target id (JS object spread). AND-combine instead.
  const count = await prisma.student.count({
    where: {
      AND: [{ id: studentId }, scope],
    },
  });
  return count > 0;
}

/**
 * Checks whether a user may view a given session (must be attached to a
 * student they can see).
 */
export async function canAccessSession(user: TokenPayload, sessionId: string): Promise<boolean> {
  const scope = await getSessionScope(user);
  const count = await prisma.session.count({
    where: {
      id: sessionId,
      ...scope,
    },
  });
  return count > 0;
}
