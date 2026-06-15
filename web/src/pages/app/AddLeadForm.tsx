import { useState } from 'react';
import { api, Lead } from '../../api';
import { ErrorNote } from '../../components/ui';

/**
 * Inline "add a single lead" form. Captures per-channel consent up front so the
 * lead can be contacted without a separate step (the send gate requires it).
 */
export default function AddLeadForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    estimatedValue: '',
    source: 'manual',
    consentEmail: true,
    consentSms: true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post<{ lead: Lead }>('/leads', {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        source: form.source,
        estimatedValue: form.estimatedValue ? Math.round(Number(form.estimatedValue)) : undefined,
        consentEmail: form.consentEmail,
        consentSms: form.consentSms,
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card mt-4 space-y-4" onSubmit={submit}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Add a lead</h2>
        <button type="button" className="text-sm text-slate-400 hover:text-slate-600" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Name *</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Estimated value ($)</label>
          <input className="input" type="number" min="0" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>

      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-700">Consent (required before this lead can be contacted)</p>
        <div className="mt-2 flex flex-col gap-2 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.consentEmail} onChange={(e) => setForm({ ...form, consentEmail: e.target.checked })} />
            This lead agreed to be contacted by <b>email</b>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.consentSms} onChange={(e) => setForm({ ...form, consentSms: e.target.checked })} />
            This lead agreed to be contacted by <b>SMS / text</b>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Consent is on by default. <b>Uncheck</b> a box if you don't have permission to contact this lead on
          that channel — it's a legal requirement (TCPA for texts, CAN-SPAM for email).
        </p>
      </div>

      {error && <ErrorNote message={error} />}
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add lead'}</button>
    </form>
  );
}
