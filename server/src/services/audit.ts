import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/** Append an immutable audit record. Never throws into the request path. */
export async function audit(params: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: params.metadata ? (params.metadata as object) : undefined,
      },
    });
  } catch (err) {
    logger.error('audit write failed', { err: String(err), action: params.action });
  }
}
