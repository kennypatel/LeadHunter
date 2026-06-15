import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/Layouts';
import { api, Lead } from '../../api';
import { ScoreBadge, StatusBadge, money, Spinner, ErrorNote } from '../../components/ui';

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (scoreFilter) params.set('score', scoreFilter);
      const { leads } = await api.get<{ leads: Lead[] }>(`/leads?${params.toString()}`);
      setLeads(leads);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreFilter]);

  async function importCsv(file: File) {
    setNotice('');
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post<{ imported: number; skipped: number }>('/leads/import', fd);
      setNotice(`Imported ${res.imported} leads, skipped ${res.skipped} duplicates.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function bulkRecovery() {
    setNotice('');
    try {
      const res = await api.post<{ queued: number; skipped: number }>('/dashboard/bulk-recovery', { type: 'SMS' });
      setNotice(`Queued ${res.queued} drafts for approval (skipped ${res.skipped}).`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import CSV</button>
          <button className="btn-primary" onClick={bulkRecovery}>Bulk recovery (SMS)</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select className="input max-w-[10rem]" value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}>
          <option value="">All scores</option>
          {['HOT', 'WARM', 'COLD', 'STALE', 'DEAD'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-secondary" onClick={load}>Search</button>
      </div>

      {notice && <div className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</div>}
      {error && <div className="mt-4"><ErrorNote message={error} /></div>}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <Spinner />
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-slate-400">No leads yet. Import a CSV to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Value</th>
                <th className="px-4 py-2">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">
                    <Link to={`/app/leads/${l.id}`} className="text-brand-700 hover:underline">{l.name}</Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{l.email || l.phone || '—'}</td>
                  <td className="px-4 py-2"><ScoreBadge score={l.score} /></td>
                  <td className="px-4 py-2"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-2">{money(l.estimatedValue)}</td>
                  <td className="px-4 py-2 text-slate-500">{l.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
