import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/Layouts';
import { api, DashboardStats } from '../../api';
import { Stat, money, Spinner, ErrorNote } from '../../components/ui';

interface WeeklyReport {
  narrative: string;
  newLeads: number;
  sentThisWeek: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState('');

  async function load() {
    // Core stats drive the page; the weekly report is secondary and must not
    // blank the dashboard if its (AI) generation fails.
    try {
      const { stats } = await api.get<{ stats: DashboardStats }>('/dashboard');
      setStats(stats);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    try {
      const { report } = await api.get<{ report: WeeklyReport }>('/dashboard/weekly-report');
      setReport(report);
    } catch {
      setReport(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <AppLayout><ErrorNote message={error} /></AppLayout>;
  if (!stats) return <AppLayout><Spinner /></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <a className="btn-secondary" href="/api/dashboard/export/leads.csv">Export leads CSV</a>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total leads" value={stats.leadsTotal} />
        <Stat label="Contacted" value={stats.leadsContacted} />
        <Stat label="Responding" value={stats.responses} />
        <Stat label="Booked estimates" value={stats.bookedEstimates} />
        <Stat label="Recovered revenue" value={money(stats.recoveredRevenue)} sub={`avg job ${money(stats.avgJobValue)}`} />
        <Stat label="Response rate" value={`${Math.round(stats.responseRate * 100)}%`} />
        <Stat label="Pending approvals" value={stats.pendingApprovals} sub="needs your review" />
        <Stat label="Failed sends" value={stats.failedSends} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Weekly report</h2>
          {report ? (
            <>
              <p className="mt-2 text-slate-600">{report.narrative}</p>
              <div className="mt-4 flex gap-6 text-sm text-slate-500">
                <span>New leads this week: <b className="text-slate-800">{report.newLeads}</b></span>
                <span>Messages sent: <b className="text-slate-800">{report.sentThisWeek}</b></span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-slate-400">No report yet.</p>
          )}
          {stats.pendingApprovals > 0 && (
            <Link to="/app/approvals" className="btn-primary mt-4">Review {stats.pendingApprovals} pending message(s)</Link>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900">Lead scores</h2>
          <div className="mt-3 space-y-2">
            {(['HOT', 'WARM', 'COLD', 'STALE', 'DEAD'] as const).map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{s}</span>
                <span className="font-semibold text-slate-900">{stats.scoreBreakdown[s] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
