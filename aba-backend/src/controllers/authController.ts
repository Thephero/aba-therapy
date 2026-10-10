import { prisma } from '../utils/prisma';
import { PLAN_LIMITS, TRIAL_DAYS } from '../services/stripe';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ─── Password reset (self-serve, Tier 0) ────────────────────────────────────
// Tokens are stored hashed; the raw token only ever appears in the
// "emailed" link. Email delivery is a console print in this MVP —
// Swap in Resend/SendGrid by replacing sendPasswordResetEmail().
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getResetFrontendBase(): string {
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return origins[0] || 'http://localhost:3000';
}

async function sendPasswordResetEmail(email: string, name: string, resetUrl: string): Promise<void> {
  // MVP delivery: print to the server log (visible in Render logs).
  // Replace this body with a real email provider call when ready.
  console.log(
    `\n📧 [PASSWORD RESET EMAIL — would be delivered to ${email}]
To: ${name} <${email}>
Subject: Reset your ABA Therapy Platform password

Hi ${name},

Someone requested a password reset for your account.
Open this link to choose a new password (valid for 1 hour):

${resetUrl}

If you didn't request this, you can ignore this email.
`
  );
}

export async function requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as Record<string, any>;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    // Always return 200 with the same message whether or not the account
    // exists — never leak which emails are registered.
    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      const resetUrl = `${getResetFrontendBase()}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    }

    res.json({
      message: 'If an account exists for that email, a reset link has been sent. Check your inbox (and spam).',
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = req.body as Record<string, any>;
    if (!token || !password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'A valid token and a password of at least 8 characters are required' });
      return;
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token as string) },
      include: { user: true },
    });

    if (
      !record ||
      record.usedAt ||
      record.expiresAt.getTime() < Date.now() ||
      !record.user.isActive
    ) {
      res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, refreshToken: null }, // force re-login everywhere
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ message: 'Password updated. You can now sign in with your new password.' });
  } catch (error) {
    next(error);
  }
}

// Role constants matching schema string values
const ROLES = {
  CENTER_ADMIN: 'CENTER_ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  THERAPIST: 'THERAPIST',
  PARENT: 'PARENT',
} as const;

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { centerName, name, email, password } = body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Create center with a 14-day trial subscription
    const center = await prisma.center.create({
      data: {
        name: centerName || `${name}'s Center`,
        subscription: {
          create: {
            plan: 'TRIAL',
            status: 'TRIALING',
            currentAmount: 0,
            activeStudentLimit: PLAN_LIMITS.PRO, // generous during trial
            trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        centerId: center.id,
        role: ROLES.CENTER_ADMIN,
        name,
        email,
        passwordHash,
      },
    });

    // Generate tokens
    const payload: TokenPayload = { userId: user.id, centerId: center.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, centerId: center.id },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { email, password } = body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const payload: TokenPayload = { userId: user.id, centerId: user.centerId, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLoginAt: new Date() },
    });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, centerId: user.centerId },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, any>;
    const { refreshToken } = body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.refreshToken !== refreshToken || !user.isActive) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const newPayload: TokenPayload = { userId: user.id, centerId: user.centerId, role: user.role };
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user) {
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { refreshToken: null },
      });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, centerId: true, isActive: true, lastLoginAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
}
