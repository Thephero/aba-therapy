import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Postgres LIKE is case-sensitive by default; SQLite's is not. Prisma only
// supports `mode: 'insensitive'` on Postgres/MySQL, so pick per-provider.
const isPostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || '');

/**
 * Case-insensitive `contains` filter that works on both SQLite (no `mode`
 * support) and Postgres (needs `mode: 'insensitive'`).
 */
export function containsInsensitive(value: string): { contains: string; mode?: 'insensitive' } {
  return isPostgres ? { contains: value, mode: 'insensitive' } : { contains: value };
}
