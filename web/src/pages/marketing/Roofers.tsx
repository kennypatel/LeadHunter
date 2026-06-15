import { useState } from 'react';
import { MarketingLayout } from '../../components/Layouts';
import { api } from '../../api';
import { money, ErrorNote } from '../../components/ui';
import LeadForm from './LeadForm';

interface Estimate {
  missedLeadsPerMonth: number;
  recoverableJobsPerMonth: number;
  recoverableRevenuePerMonth: number;
  recoverableRevenuePerYear: number;
}

export default function Roofers() {
  const [monthlyLeads, setMonthlyLeads] = useState(80);
  const [missedPct, setMissedPct] = useState(30);
  const [avgJobValue, setAvgJobValue] = useState(9000);
  const [result, setResult] = useState<Estimate | null>(null);
  const [error, setError] = useState('');

  async function calculate() {
    setError('');
    try {
      const { estimate } = await api.post<{ estimate: Estimate }>('/public/roi-calculator', {
        monthlyLeads,
        missedPct,
        avgJobValue,
      });
      setResult(estimate);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-4xl px-4 py-16">
        <span className="badge bg-brand-100 text-brand-700">Roofing owners</span>
        <h1 className="mt-3 text-4xl font-extrabold text-slate-900">
          You're leaving roofing jobs on the table
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Every missed call and forgotten quote is a roof you didn't sell. LeakHunter revives those leads
          with AI-drafted, human-approved follow-ups — so you book more estimates from leads you already own.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="card">
            <h2 className="text-xl font-bold text-slate-900">ROI calculator</h2>
            <p className="mt-1 text-sm text-slate-500">See what recovering your missed leads could be worth.</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Leads per month</label>
                <input type="number" className="input" value={monthlyLeads} onChange={(e) => setMonthlyLeads(+e.target.value)} />
              </div>
              <div>
                <label className="label">% currently missed / unworked</label>
                <input type="number" className="input" value={missedPct} onChange={(e) => setMissedPct(+e.target.value)} />
              </div>
              <div>
                <label className="label">Average job value ($)</label>
                <input type="number" className="input" value={avgJobValue} onChange={(e) => setAvgJobValue(+e.target.value)} />
              </div>
              <button className="btn-primary w-full" onClick={calculate}>Calculate</button>
              {error && <ErrorNote message={error} />}
            </div>
          </div>

          <div className="card flex flex-col justify-center bg-brand-50">
            {result ? (
              <>
                <div className="text-sm font-medium text-brand-700">Estimated recoverable revenue</div>
                <div className="mt-1 text-4xl font-extrabold text-brand-900">{money(result.recoverableRevenuePerMonth)}<span className="text-base font-medium">/mo</span></div>
                <div className="mt-1 text-sm text-brand-700">{money(result.recoverableRevenuePerYear)} per year</div>
                <div className="mt-6 space-y-1 text-sm text-slate-600">
                  <div>Missed leads / month: <b>{result.missedLeadsPerMonth}</b></div>
                  <div>Recoverable jobs / month: <b>{result.recoverableJobsPerMonth}</b></div>
                </div>
              </>
            ) : (
              <p className="text-center text-slate-500">Enter your numbers and hit calculate to see your recoverable revenue.</p>
            )}
          </div>
        </div>

        {/* Case study placeholder */}
        <div className="card mt-12">
          <h2 className="text-xl font-bold">Case study (sample)</h2>
          <p className="mt-2 text-slate-600">
            “Garden State Roofing imported 480 old leads. In the first 30 days LeakHunter drafted 210 follow-ups,
            we approved them in batches, and booked 11 estimates — about <b>$74,000</b> in recovered pipeline.”
          </p>
          <p className="mt-2 text-sm text-slate-400">Illustrative example. Your results depend on your lead volume and close rate.</p>
        </div>

        <div id="test-form" className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">Try it — send us a test lead</h2>
          <p className="mt-1 text-slate-600">Fill this out and we'll show you exactly how a recovered conversation looks.</p>
          <div className="mt-4">
            <LeadForm source="roofers_test_form" />
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
