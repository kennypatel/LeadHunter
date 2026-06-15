import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/Layouts';
import { api, Lead, Message } from '../../api';
import { useAuth } from '../../auth';
import { ScoreBadge, StatusBadge, money, Spinner, ErrorNote } from '../../components/ui';

interface FullLead extends Lead {
  notes: { id: string; text: string; createdAt: string }[];
  messages: Message[];
  tasks: { id: string; title: string; status: string }[];
  company?: { name: string };
}

interface Insights {
  summary: string;
  nextBestAction: string;
  scoreReason?: string | null;
}

// Draft states that can still be sent (i.e. not already sent/delivered/rejected).
const SENDABLE = ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'FAILED'];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState<FullLead | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { lead } = await api.get<{ lead: FullLead }>(`/leads/${id}`);
      setLead(lead);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function draft(type: 'EMAIL' | 'SMS') {
    setBusy(true);
    setError('');
    try {
      await api.post(`/leads/${id}/draft`, { type });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Send a drafted message now: approve-and-send if it's still pending, else
  // (re)send an already-approved/failed one. The server enforces the consent gate.
  async function sendNow(m: Message) {
    if (!confirm(`Send this ${m.type.toLowerCase()} now?`)) return;
    setBusy(true);
    setError('');
    try {
      if (m.status === 'PENDING_APPROVAL') {
        await api.post(`/messages/${m.id}/approve`, { sendNow: true });
      } else {
        await api.post(`/messages/${m.id}/send`);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadInsights() {
    setInsights(null);
    try {
      const data = await api.get<Insights>(`/leads/${id}/insights`);
      setInsights(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    await api.post(`/leads/${id}/notes`, { text: note });
    setNote('');
    load();
  }

  async function setStatus(status: string) {
    try {
      await api.patch(`/leads/${id}`, { status });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function patchLead(data: Record<string, boolean>) {
    try {
      await api.patch(`/leads/${id}`, data);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteLead() {
    if (!confirm(`Delete "${lead?.name}"? This permanently removes the lead and all its notes, tasks, and messages.`)) {
      return;
    }
    try {
      await api.del(`/leads/${id}`);
      navigate('/app/leads');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error && !lead) return <AppLayout><ErrorNote message={error} /></AppLayout>;
  if (!lead) return <AppLayout><Spinner /></AppLayout>;

  return (
    <AppLayout>
      <Link to="/app/leads" className="text-sm text-brand-600">← Back to leads</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <ScoreBadge score={lead.score} />
            <StatusBadge status={lead.status} />
            <span>{lead.email || '—'}</span>
            <span>{lead.phone || '—'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => draft('SMS')} disabled={busy}>Draft SMS</button>
          <button className="btn-secondary" onClick={() => draft('EMAIL')} disabled={busy}>Draft Email</button>
          <button className="btn-primary" onClick={loadInsights}>AI insights</button>
          <button className="btn-secondary text-red-600" onClick={deleteLead}>Delete</button>
        </div>
      </div>

      {error && <div className="mt-4"><ErrorNote message={error} /></div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {insights && (
            <div className="card bg-brand-50">
              <h2 className="font-semibold text-brand-900">AI insights</h2>
              <p className="mt-2 text-sm text-slate-700"><b>Next best action:</b> {insights.nextBestAction}</p>
              <p className="mt-1 text-sm text-slate-700"><b>History:</b> {insights.summary}</p>
              {insights.scoreReason && <p className="mt-1 text-sm text-slate-700"><b>Why {lead.score}:</b> {insights.scoreReason}</p>}
            </div>
          )}

          <div className="card">
            <h2 className="font-semibold text-slate-900">Timeline</h2>
            <div className="mt-4 space-y-3">
              {[...(lead.messages ?? []).map((m) => ({ kind: 'msg' as const, id: m.id, at: m.createdAt, m })),
                ...(lead.notes ?? []).map((n) => ({ kind: 'note' as const, id: n.id, at: n.createdAt, n })),
              ]
                .sort((a, b) => +new Date(b.at) - +new Date(a.at))
                .map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="border-l-2 border-slate-100 pl-3 text-sm">
                    <div className="text-xs text-slate-400">{new Date(item.at).toLocaleString()}</div>
                    {item.kind === 'msg' ? (
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="badge bg-slate-100 text-slate-600">{item.m.type}</span>{' '}
                            <span className="badge bg-blue-50 text-blue-700">{item.m.status}</span>
                          </div>
                          {user?.role === 'ADMIN' && SENDABLE.includes(item.m.status) && (
                            <button className="btn-primary text-xs" disabled={busy} onClick={() => sendNow(item.m)}>
                              Send now
                            </button>
                          )}
                        </div>
                        {item.m.subject && <p className="mt-1 text-xs font-medium text-slate-500">Subject: {item.m.subject}</p>}
                        <p className="mt-1 whitespace-pre-wrap text-slate-700">{item.m.content}</p>
                      </div>
                    ) : (
                      <p className="text-slate-700">📝 {item.n.text}</p>
                    )}
                  </div>
                ))}
              {(lead.messages ?? []).length === 0 && (lead.notes ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No activity yet. Draft a follow-up to get started.</p>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-slate-900">Add note</h2>
            <textarea className="input mt-2" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-secondary mt-2" onClick={addNote}>Save note</button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-slate-900">Pipeline</h2>
            <div className="mt-3 flex flex-wrap gap-1">
              {['NEW', 'CONTACTED', 'RESPONDING', 'ESTIMATE', 'BOOKED', 'CLOSED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`badge ${lead.status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-slate-900">Details</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Estimated value</dt><dd>{money(lead.estimatedValue)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Source</dt><dd>{lead.source || '—'}</dd></div>
            </dl>
          </div>

          <div className="card">
            <h2 className="font-semibold text-slate-900">Consent</h2>
            <p className="mt-1 text-xs text-slate-400">
              Only mark consent you genuinely have — required before sending (TCPA / CAN-SPAM).
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center justify-between">
                <span className="text-slate-600">Email consent</span>
                <input
                  type="checkbox"
                  checked={lead.consentEmail}
                  disabled={lead.unsubscribed}
                  onChange={(e) => patchLead({ consentEmail: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-600">SMS consent</span>
                <input
                  type="checkbox"
                  checked={lead.consentSms}
                  disabled={lead.unsubscribed}
                  onChange={(e) => patchLead({ consentSms: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-600">Unsubscribed (do not contact)</span>
                <input
                  type="checkbox"
                  checked={lead.unsubscribed}
                  onChange={(e) => patchLead({ unsubscribed: e.target.checked })}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
