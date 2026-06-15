import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, scopedCompanyId } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { computeRoi } from '../utils/roi';
import { runBulkRecovery } from '../services/recovery';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const AVG_JOB_VALUE_FALLBACK = 9000; // typical NJ roofing job

// Resolve which company a read targets. Admins get a global (null) rollup when
// they don't name a company; non-admins are pinned to theirs and may never see
// cross-tenant aggregates.
function resolveTarget(req: import('express').Request): string | null {
  const companyId = scopedCompanyId(req, (req.query.companyId as string) || (req.body?.companyId as string));
  if (req.user!.role === 'ADMIN') {
    const requested = (req.query.companyId as string) || (req.body?.companyId as string);
    return requested ? companyId : null;
  }
  if (!companyId) throw new HttpError(400, 'No company in scope');
  return companyId;
}

async function buildStats(companyId: string | null) {
  const where = companyId ? { companyId } : {};

  const [leadsTotal, contacted, responding, booked, pendingApprovals, failedSends, valueAgg] =
    await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: { in: ['CONTACTED', 'RESPONDING', 'ESTIMATE', 'BOOKED'] } } }),
      prisma.lead.count({ where: { ...where, status: { in: ['RESPONDING', 'ESTIMATE', 'BOOKED'] } } }),
      prisma.lead.count({ where: { ...where, status: 'BOOKED' } }),
      prisma.message.count({ where: { ...where, status: 'PENDING_APPROVAL' } }),
      prisma.message.count({ where: { ...where, status: 'FAILED' } }),
      prisma.lead.aggregate({ where: { ...where, status: 'BOOKED' }, _avg: { estimatedValue: true } }),
    ]);

  // Only fall back when there are no booked leads at all (avg is null).
  // A genuine $0 average must stay $0 so we don't fabricate recovered revenue.
  const avg = valueAgg._avg.estimatedValue;
  const avgJobValue = avg == null ? AVG_JOB_VALUE_FALLBACK : Math.round(avg);
  const roi = computeRoi({
    leadsTotal,
    leadsContacted: contacted,
    responses: responding,
    bookedEstimates: booked,
    avgJobValue,
  });

  const scoreBreakdown = await prisma.lead.groupBy({
    by: ['score'],
    where,
    _count: { _all: true },
  });

  return {
    leadsTotal,
    leadsContacted: contacted,
    responses: responding,
    bookedEstimates: booked,
    pendingApprovals,
    failedSends,
    avgJobValue,
    recoveredRevenue: roi.recoveredRevenue,
    responseRate: roi.responseRate,
    bookingRate: roi.bookingRate,
    scoreBreakdown: Object.fromEntries(scoreBreakdown.map((s) => [s.score, s._count._all])),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const stats = await buildStats(resolveTarget(req));
    res.json({ stats });
  })
);

// Admin overview of every client.
router.get(
  '/clients',
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admins only' });
    const companies = await prisma.company.findMany({
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const rows = await Promise.all(
      companies.map(async (c) => ({
        company: { id: c.id, name: c.name },
        stats: await buildStats(c.id),
      }))
    );
    res.json({ clients: rows });
  })
);

// Weekly report generation (AI-ready narrative + numbers).
router.get(
  '/weekly-report',
  asyncHandler(async (req, res) => {
    const companyId = resolveTarget(req);
    const stats = await buildStats(companyId);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where = companyId ? { companyId } : {};
    const [newLeads, sentThisWeek] = await Promise.all([
      prisma.lead.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
      prisma.message.count({ where: { ...where, sentAt: { gte: weekAgo } } }),
    ]);
    const narrative =
      `This week LeakHunter added ${newLeads} new leads and sent ${sentThisWeek} approved follow-ups. ` +
      `${stats.responses} leads are now responding and ${stats.bookedEstimates} estimates are booked, ` +
      `representing an estimated $${stats.recoveredRevenue.toLocaleString()} in recoverable revenue. ` +
      `${stats.pendingApprovals} message(s) are waiting for your approval.`;
    res.json({ report: { generatedAt: new Date(), stats, newLeads, sentThisWeek, narrative } });
  })
);

// Trigger a bulk recovery run for the company.
const bulkSchema = z.object({
  type: z.enum(['EMAIL', 'SMS']),
  workflow: z.enum(['missed_call', 're_engage', 'estimate_followup']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
router.post(
  '/bulk-recovery',
  asyncHandler(async (req, res) => {
    const companyId = scopedCompanyId(req, req.body.companyId);
    if (!companyId) return res.status(400).json({ error: 'No company in scope' });
    const { type, workflow, limit } = bulkSchema.parse(req.body);
    const result = await runBulkRecovery({ companyId, type, workflow, limit, actorId: req.user!.id });
    res.json(result);
  })
);

// CSV export of leads.
router.get(
  '/export/leads.csv',
  asyncHandler(async (req, res) => {
    const companyId = resolveTarget(req);
    const leads = await prisma.lead.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { createdAt: 'desc' },
    });
    const header = 'name,email,phone,source,status,score,estimatedValue,createdAt\n';
    const rows = leads
      .map((l) =>
        [l.name, l.email ?? '', l.phone ?? '', l.source ?? '', l.status, l.score, l.estimatedValue, l.createdAt.toISOString()]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(header + rows);
  })
);

export default router;
