// Sales enablement: generate proposals and ROI summaries from client data.
// Returns structured JSON the frontend renders as a one-page proposal (and can
// print to PDF). Keeps pricing tiers in one place.
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { computeRoi } from '../utils/roi';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

export const PRICING = {
  audit: { name: 'Audit', priceRange: [250, 500], description: 'Full lead-leak audit + recovery plan' },
  launch: { name: 'Launch', priceRange: [750, 1250], description: 'Setup, CSV import, templates, go-live' },
  retainer: { name: 'Retainer', priceRange: [500, 1500], unit: '/mo', description: 'Ongoing recovery + weekly reports' },
  performance: { name: 'Performance bonus', description: 'Optional % of recovered revenue' },
};

router.get(
  '/proposal/:companyId',
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { id: req.params.companyId } });
    if (!company) throw new HttpError(404, 'Company not found');

    const [leadsTotal, contacted, responding, booked, valueAgg] = await Promise.all([
      prisma.lead.count({ where: { companyId: company.id } }),
      prisma.lead.count({ where: { companyId: company.id, status: { in: ['CONTACTED', 'RESPONDING', 'ESTIMATE', 'BOOKED'] } } }),
      prisma.lead.count({ where: { companyId: company.id, status: { in: ['RESPONDING', 'ESTIMATE', 'BOOKED'] } } }),
      prisma.lead.count({ where: { companyId: company.id, status: 'BOOKED' } }),
      prisma.lead.aggregate({ where: { companyId: company.id }, _avg: { estimatedValue: true } }),
    ]);

    const avgJobValue = Math.round(valueAgg._avg.estimatedValue || 9000);
    const roi = computeRoi({ leadsTotal, leadsContacted: contacted, responses: responding, bookedEstimates: booked, avgJobValue });

    res.json({
      proposal: {
        company: { name: company.name, serviceArea: company.serviceArea },
        generatedAt: new Date(),
        summary: {
          leadsOnFile: leadsTotal,
          avgJobValue,
          estimatedRecoverableRevenue: roi.recoveredRevenue,
        },
        offer: {
          pilot: {
            name: 'Pilot Offer',
            price: '$500 one-time',
            includes: ['Lead audit', 'Import up to 500 old leads', '2 recovery campaigns', 'Weekly report'],
          },
          retainer: {
            name: 'Monthly Retainer',
            price: '$750/mo',
            includes: ['Ongoing recovery', 'Missed-call follow-up', 'Approval queue', 'Weekly ROI reports'],
          },
        },
        pricing: PRICING,
        promise: `Recover lost revenue from leads ${company.name} already paid for. Estimated $${roi.recoveredRevenue.toLocaleString()} in recoverable revenue based on current data.`,
      },
    });
  })
);

export default router;
