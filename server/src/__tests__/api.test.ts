import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('public API', () => {
  it('rejects unauthenticated access to protected routes', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
  });

  it('computes ROI from the public calculator without auth', async () => {
    const res = await request(app)
      .post('/api/public/roi-calculator')
      .send({ monthlyLeads: 100, missedPct: 30, avgJobValue: 9000, closeRate: 0.25 });
    expect(res.status).toBe(200);
    expect(res.body.estimate.recoverableRevenuePerYear).toBe(810000);
  });

  it('validates the lead-capture form', async () => {
    const res = await request(app).post('/api/public/leads').send({ name: 'No Contact Info' });
    expect(res.status).toBe(400);
  });
});
