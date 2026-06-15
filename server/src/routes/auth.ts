import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { authenticate, signToken } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { audit } from '../services/audit';
import { logger } from '../lib/logger';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
  companyName: z.string().min(1).optional(),
});

function setAuthCookie(res: import('express').Response, token: string) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

// Register a new CLIENT account (roofing owner self-signup / onboarding step 1).
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name, companyName } = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'An account with that email already exists');

    const passwordHash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(24).toString('hex');

    const company = companyName
      ? await prisma.company.create({ data: { name: companyName } })
      : null;
    if (company) {
      await prisma.onboarding.create({ data: { companyId: company.id, step: 2 } });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'CLIENT',
        companyId: company?.id ?? null,
        verifyToken,
      },
    });

    // In production this token would be emailed. We log it for dev.
    logger.info('email verification token issued', { email, verifyUrl: `${env.appBaseUrl}/api/auth/verify?token=${verifyToken}` });

    const authUser = { id: user.id, email: user.email, role: user.role, companyId: user.companyId };
    const token = signToken(authUser);
    setAuthCookie(res, token);
    await audit({ actorId: user.id, action: 'auth.register', entity: 'User', entityId: user.id });
    res.status(201).json({ user: authUser, token });
  })
);

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(401, 'Invalid email or password');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Invalid email or password');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const authUser = { id: user.id, email: user.email, role: user.role, companyId: user.companyId };
    const token = signToken(authUser);
    setAuthCookie(res, token);
    await audit({ actorId: user.id, action: 'auth.login', entity: 'User', entityId: user.id });
    res.json({ user: authUser, token });
  })
);

router.post('/logout', (req, res) => {
  res.clearCookie(env.cookieName);
  res.json({ ok: true });
});

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { company: true },
    });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        emailVerified: user.emailVerified,
        company: user.company,
      },
    });
  })
);

router.get(
  '/verify',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? '');
    const user = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (!token || !user) throw new HttpError(400, 'Invalid verification token');
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, verifyToken: null } });
    res.json({ ok: true, message: 'Email verified' });
  })
);

const forgotSchema = z.object({ email: z.string().email() });
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Always respond OK to avoid account enumeration.
    if (user) {
      const resetToken = crypto.randomBytes(24).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetExpiresAt: new Date(Date.now() + 1000 * 60 * 60) },
      });
      logger.info('password reset token issued', { email, resetToken });
    }
    res.json({ ok: true, message: 'If that account exists, a reset link was sent.' });
  })
);

const resetSchema = z.object({ token: z.string(), password: z.string().min(8) });
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password } = resetSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { resetToken: token } });
    if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
      throw new HttpError(400, 'Invalid or expired reset token');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetExpiresAt: null },
    });
    await audit({ actorId: user.id, action: 'auth.password_reset', entity: 'User', entityId: user.id });
    res.json({ ok: true, message: 'Password updated' });
  })
);

export default router;
