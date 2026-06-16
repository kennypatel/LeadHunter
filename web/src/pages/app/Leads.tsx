import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/Layouts';
import { api, Lead } from '../../api';
import { ScoreBadge, StatusBadge, money, Spinner, ErrorNote } from '../../components/ui';
import AddLeadForm from './AddLeadForm';
import CompanySetup from './CompanySetup';
import { useAuth } from '../../auth';

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
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
    if (user?.companyId) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreFilter, user?.companyId]);

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

  const [sendingId, setSendingId] = useState<string | null>(null);
  async function sendEmail(l: Lead) {
    if (!l.email) {
      setError(`${l.name} has no email address.`);
      return;
    }
    if (!confirm(`Send an email to ${l.name} (${l.email}) now?`)) return;
    setError('');
    setNotice('');
    setSendingId(l.id);
    try {
      // Sends the lead's latest email draft, or drafts one first, then sends it.
      await api.post(`/leads/${l.id}/send-email`);
      setNotice(`Email sent to ${l.name}.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSendingId(null);
    }
  }

  const [drafting, setDrafting] = useState(false);
  async function draftEmailToAll() {
    setNotice('');
    setError('');
    setDrafting(true);
    try {
      // Draft an email for every lead with an email that doesn't already have one.
      const res = await api.post<{ queued: number; skipped: number }>('/dashboard/bulk-recovery', {
        type: 'EMAIL',
        skipExisting: true,
      });
      setNotice(`Drafted ${res.queued} email(s) — review them in Approvals (skipped ${res.skipped}).`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  if (!user?.companyId) {
    return (
      <AppLayout>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Leads</h1>
        <p className="mb-6 text-sm text-slate-500">First, set up the company you're managing.</p>
        <CompanySetup />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          <button className="btn-secondary" onClick={() => setShowAdd((v) => !v)}>Add lead</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import CSV</button>
          <button className="btn-primary" onClick={draftEmailToAll} disabled={drafting}>
            {drafting ? 'Drafting…' : 'Draft email to all'}
          </button>
        </div>
      </div>

      {showAdd && (
        <AddLeadForm
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            setNotice('Lead added.');
            load();
          }}
        />
      )}

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
                {user?.role === 'ADMIN' && <th className="px-4 py-2 text-right">Action</th>}
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
                  {user?.role === 'ADMIN' && (
                    <td className="px-4 py-2 text-right">
                      <button
                        className="btn-primary text-xs"
                        disabled={sendingId === l.id || !l.email}
                        title={l.email ? 'Draft (if needed) and send an email now' : 'No email address'}
                        onClick={() => sendEmail(l)}
                      >
                        {sendingId === l.id ? 'Sending…' : 'Send'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
