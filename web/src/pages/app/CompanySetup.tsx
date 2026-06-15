import { useState } from 'react';
import { api, Company } from '../../api';
import { useAuth } from '../../auth';
import { ErrorNote } from '../../components/ui';

/**
 * First-run company creation for an operator/admin who has no company yet.
 * On success the server returns a fresh token (with the new companyId) which we
 * store, then refresh the session so the rest of the app is scoped correctly.
 */
export default function CompanySetup({ onDone }: { onDone?: () => void }) {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', serviceArea: '', address: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ company: Company; token?: string }>('/companies', form);
      if (res.token) api.setToken(res.token);
      await refresh();
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <form className="card space-y-4" onSubmit={submit}>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Set up your company</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add the roofing business you're recovering leads for. You can edit these details later.
          </p>
        </div>
        <div>
          <label className="label">Company name *</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Service area</label>
            <input className="input" placeholder="e.g. Essex County, NJ" value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        {error && <ErrorNote message={error} />}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create company'}</button>
      </form>
    </div>
  );
}
