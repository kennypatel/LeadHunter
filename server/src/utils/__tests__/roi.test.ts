import { computeRoi, calculatorEstimate } from '../roi';

describe('computeRoi', () => {
  it('computes response and booking rates', () => {
    const r = computeRoi({ leadsTotal: 100, leadsContacted: 50, responses: 20, bookedEstimates: 10, avgJobValue: 9000 });
    expect(r.responseRate).toBe(0.4);
    expect(r.bookingRate).toBe(0.2);
  });

  it('projects recovered revenue from booked estimates and close rate', () => {
    const r = computeRoi({ leadsTotal: 100, leadsContacted: 50, responses: 20, bookedEstimates: 10, avgJobValue: 9000, closeRate: 0.5 });
    expect(r.projectedJobs).toBe(5);
    expect(r.recoveredRevenue).toBe(45000);
  });

  it('handles zero contacted without dividing by zero', () => {
    const r = computeRoi({ leadsTotal: 0, leadsContacted: 0, responses: 0, bookedEstimates: 0, avgJobValue: 9000 });
    expect(r.responseRate).toBe(0);
    expect(r.recoveredRevenue).toBe(0);
  });
});

describe('calculatorEstimate', () => {
  it('estimates monthly + yearly recoverable revenue', () => {
    const r = calculatorEstimate({ monthlyLeads: 100, missedPct: 30, avgJobValue: 9000, closeRate: 0.25 });
    expect(r.missedLeadsPerMonth).toBe(30);
    expect(r.recoverableJobsPerMonth).toBe(7.5);
    expect(r.recoverableRevenuePerMonth).toBe(67500);
    expect(r.recoverableRevenuePerYear).toBe(810000);
  });
});
