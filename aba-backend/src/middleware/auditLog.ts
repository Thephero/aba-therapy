import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function auditLog(action: string, entityType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original res.json to intercept the response
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Log after response is sent (only for successful requests)
      const statusCode = res.statusCode;
      if (statusCode >= 200 && statusCode < 300 && req.user) {
        const entityId = body?.id || req.params.id || req.params.studentId || null;

        prisma.auditLog.create({
          data: {
            centerId: req.user.centerId,
            userId: req.user.userId,
            action,
            entityType,
            entityId: entityId as string | null,
            details: JSON.stringify({
              method: req.method,
              path: req.path,
              body: sanitizeBody(req.body),
            }),
            ipAddress: req.ip || req.socket.remoteAddress || null,
            userAgent: req.headers['user-agent'] || null,
          },
        }).catch((err) => {
          console.error('Failed to create audit log:', err);
        });
      }

      return originalJson(body);
    };

    next();
  };
}

function sanitizeBody(body: any): any {
  if (!body) return {};
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.passwordHash;
  delete sanitized.refreshToken;
  return sanitized;
}
