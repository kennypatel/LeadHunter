import { ReactNode } from 'react';
import { LeadScore, LeadStatus } from '../api';

const SCORE_STYLES: Record<LeadScore, string> = {
  HOT: 'bg-red-100 text-red-700',
  WARM: 'bg-orange-100 text-orange-700',
  COLD: 'bg-sky-100 text-sky-700',
  STALE: 'bg-slate-100 text-slate-600',
  DEAD: 'bg-slate-200 text-slate-500 line-through',
};

export function ScoreBadge({ score }: { score: LeadScore }) {
  return <span className={`badge ${SCORE_STYLES[score]}`}>{score}</span>;
}

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  CONTACTED: 'bg-blue-100 text-blue-700',
  RESPONDING: 'bg-indigo-100 text-indigo-700',
  ESTIMATE: 'bg-purple-100 text-purple-700',
  BOOKED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-200 text-slate-500',
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{status}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

export function Spinner() {
  return <div className="py-10 text-center text-slate-400">Loading…</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>;
}
