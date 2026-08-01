import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { Request, Response, NextFunction } from 'express';

export async function listCenters(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const centers = await prisma.center.findMany({
      include: {
        subscription: true,
        _count: { select: { users: true, students: true } },
      },
    });
    res.json({ centers });
  } catch (error) {
    next(error);
  }
}

export async function getCenter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const center = await prisma.center.findUnique({
      where: { id: req.params.id as string },
      include: {
        subscription: true,
        _count: { select: { users: true, students: true } },
      },
    });

    if (!center) {
      res.status(404).json({ error: 'Center not found' });
      return;
    }

    res.json({ center });
  } catch (error) {
    next(error);
  }
}

export async function updateCenter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { name } = body;
    const center = await prisma.center.update({
      where: { id: req.params.id as string },
      data: { ...(name && { name }) },
    });
    res.json({ center });
  } catch (error) {
    next(error);
  }
}
