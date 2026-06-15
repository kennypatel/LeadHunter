import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/Layouts';
import { api } from '../../api';
import { Spinner, ErrorNote } from '../../components/ui';

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  actor?: { email: string } | null;
}
interface FailedMessage {
  id: string;
  content: string;
  failureReason?: string | null;
  lead?: { name: string };
}
interface Flag {
  id: string;
  key: string;
  enabled: boolean;
  description?: string | null;
}

export default function Admin() {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [failed, setFailed] = useState<FailedMessage[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [a, f, fl] = await Promise.all([
        api.get<{ logs: AuditEntry[] }>('/admin/audit'),
        api.get<{ messages: FailedMessage[] }>('/admin/failed-messages'),
        api.get<{ flags: Flag[] }>('/admin/flags'),
      ]);
      setAudit(a.logs);
      setFailed(f.messages);
      setFlags(fl.flags);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function retry() {
    setNotice('');
    const res = await api.post<{ sent: number; failed: number; blocked: number }>('/admin/retry-due');
    setNotice(`Retry run: ${res.sent} sent, ${res.failed} failed, ${res.blocked} blocked.`);
    load();
  }

  async function toggleFlag(f: Flag) {
    await api.put(`/admin/flags/${f.key}`, { enabled: !f.enabled, description: f.description ?? undefined });
    load();
  }

  async function clearPhones() {
    if (!confirm('Permanently delete the phone number on EVERY lead? This cannot be undone.')) return;
    setNotice('');
    try {
      const res = await api.post<{ cleared: number }>('/admin/clear-phone-numbers');
      setNotice(`Cleared phone numbers from ${res.cleared} lead(s).`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <AppLayout><Spinner /></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Admin tools</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={retry}>Retry due jobs</button>
          <a className="btn-secondary" href="/api/admin/export.json">Export JSON</a>
          <button className="btn-secondary text-red-600" onClick={clearPhones}>Clear all phone numbers</button>
        </div>
      </div>
      {error && <div className="mt-4"><ErrorNote message={error} /></div>}
      {notice && <div className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-slate-900">Feature flags</h2>
          <div className="mt-3 space-y-2">
            {flags.length === 0 && <p className="text-sm text-slate-400">No flags yet.</p>}
            {flags.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{f.key}</div>
                  {f.description && <div className="text-xs text-slate-400">{f.description}</div>}
                </div>
                <button className={`badge ${f.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`} onClick={() => toggleFlag(f)}>
                  {f.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900">Failed sends</h2>
          <div className="mt-3 space-y-2 text-sm">
            {failed.length === 0 && <p className="text-slate-400">No failed messages.</p>}
            {failed.map((m) => (
              <div key={m.id} className="rounded-md bg-red-50 p-2">
                <div className="font-medium text-red-800">{m.lead?.name}</div>
                <div className="text-xs text-red-600">{m.failureReason}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold text-slate-900">Audit log</h2>
        <div className="mt-3 max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr><th className="py-1">When</th><th>Actor</th><th>Action</th><th>Entity</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="py-1 text-slate-400">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="text-slate-600">{a.actor?.email ?? 'system'}</td>
                  <td className="font-medium text-slate-800">{a.action}</td>
                  <td className="text-slate-500">{a.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
