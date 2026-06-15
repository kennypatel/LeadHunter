import { prisma } from '../lib/prisma';

// Live-send kill-switches. All default OFF: real outreach cannot leave the
// system until these are explicitly enabled (per channel), even after a human
// approves a message. SMS stays gated until A2P 10DLC registration is complete.
export const SEND_FLAGS = {
  live: 'live_sending', // master switch
  email: 'email_sending',
  sms: 'sms_sending',
} as const;

/** Read a feature flag; missing flags are treated as disabled. */
export async function isFlagEnabled(key: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  return !!flag?.enabled;
}
