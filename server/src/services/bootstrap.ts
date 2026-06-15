// First-run bootstrap: create an ADMIN account from env vars if none exists.
// Lets a fresh deploy be logged into without running the demo seed.
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export async function ensureAdmin(): Promise<void> {
  if (!env.adminEmail || !env.adminPassword) return;
  try {
    const existing = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (existing > 0) return;
    const passwordHash = await bcrypt.hash(env.adminPassword, 10);
    await prisma.user.create({
      data: {
        email: env.adminEmail.toLowerCase(),
        passwordHash,
        name: env.adminName,
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    logger.info('bootstrap admin created', { email: env.adminEmail });
  } catch (err) {
    logger.error('ensureAdmin failed', { err: String(err) });
  }
}

// Ensure the live-send kill-switch flags exist (all OFF) so the Admin UI can
// toggle them. Mirrors the seed for non-seeded deploys.
export async function ensureSendFlags(): Promise<void> {
  const flags = [
    { key: 'live_sending', description: 'Master switch: allow real (non-console) message sending' },
    { key: 'email_sending', description: 'Allow real email sends (requires verified domain + SPF/DKIM)' },
    { key: 'sms_sending', description: 'Allow real SMS sends (requires A2P 10DLC + per-lead consent)' },
  ];
  for (const f of flags) {
    try {
      await prisma.featureFlag.upsert({
        where: { key: f.key },
        update: {},
        create: { key: f.key, enabled: false, description: f.description },
      });
    } catch (err) {
      logger.error('ensureSendFlags failed', { key: f.key, err: String(err) });
    }
  }
}
