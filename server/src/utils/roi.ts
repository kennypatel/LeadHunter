// ROI math used by the dashboards, weekly reports and the public ROI calculator.

export interface RoiInputs {
  leadsTotal: number;
  leadsContacted: number;
  responses: number;
  bookedEstimates: number;
  avgJobValue: number; // dollars
  closeRate?: number; // 0..1, fraction of booked estimates that become jobs
}

export interface RoiResult {
  responseRate: number; // 0..1
  bookingRate: number; // 0..1 (booked / contacted)
  projectedJobs: number;
  recoveredRevenue: number; // dollars
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeRoi(inputs: RoiInputs): RoiResult {
  const closeRate = inputs.closeRate ?? 0.4;
  const responseRate = inputs.leadsContacted > 0 ? inputs.responses / inputs.leadsContacted : 0;
  const bookingRate = inputs.leadsContacted > 0 ? inputs.bookedEstimates / inputs.leadsContacted : 0;
  const projectedJobs = inputs.bookedEstimates * closeRate;
  const recoveredRevenue = projectedJobs * inputs.avgJobValue;

  return {
    responseRate: round2(responseRate),
    bookingRate: round2(bookingRate),
    projectedJobs: round2(projectedJobs),
    recoveredRevenue: Math.round(recoveredRevenue),
  };
}

/**
 * Marketing ROI calculator: estimate recoverable revenue from missed calls /
 * old leads for the public landing page.
 */
export interface CalculatorInputs {
  monthlyLeads: number;
  missedPct: number; // 0..100, percent of leads currently going unworked
  avgJobValue: number;
  closeRate?: number; // 0..1
}

export function calculatorEstimate(inputs: CalculatorInputs): {
  missedLeadsPerMonth: number;
  recoverableJobsPerMonth: number;
  recoverableRevenuePerMonth: number;
  recoverableRevenuePerYear: number;
} {
  const closeRate = inputs.closeRate ?? 0.25;
  const missedLeadsPerMonth = (inputs.monthlyLeads * inputs.missedPct) / 100;
  // Assume LeakHunter re-engages and recovers a conservative slice of the missed.
  const recoverableJobsPerMonth = missedLeadsPerMonth * closeRate;
  const recoverableRevenuePerMonth = recoverableJobsPerMonth * inputs.avgJobValue;

  return {
    missedLeadsPerMonth: round2(missedLeadsPerMonth),
    recoverableJobsPerMonth: round2(recoverableJobsPerMonth),
    recoverableRevenuePerMonth: Math.round(recoverableRevenuePerMonth),
    recoverableRevenuePerYear: Math.round(recoverableRevenuePerMonth * 12),
  };
}
