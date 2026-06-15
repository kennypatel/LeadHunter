import { useState } from 'react';
import { api } from '../../api';
import { ErrorNote } from '../../components/ui';

export default function LeadForm({ source = 'website' }: { source?: string }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('sending');
    try {
      await api.post('/public/leads', { ...form, source });
      setStatus('done');
    } catch (err) {
      setError((err as Error).message);
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <div className="card bg-green-50 text-green-800">
        <h3 className="font-semibold">Thanks, {form.name || 'there'}!</h3>
        <p className="mt-1 text-sm">We got your info and will reach out shortly.</p>
      </div>
    );
  }

  return (
    <form className="card space-y-4" onSubmit={submit}>
      <div>
        <label className="label">Name *</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">What do you need help with?</label>
        <textarea className="input" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </div>
      <p className="text-xs text-slate-400">Provide an email or phone so we can reach you.</p>
      {error && <ErrorNote message={error} />}
      <button className="btn-primary w-full" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Get Your Free Audit'}
      </button>
    </form>
  );
}
