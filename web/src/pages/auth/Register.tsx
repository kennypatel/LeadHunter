import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { ErrorNote } from '../../components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/app/onboarding');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 block text-center text-2xl font-extrabold text-brand-700">
          Leak<span className="text-slate-900">Hunter</span>
        </Link>
        <form className="card space-y-4" onSubmit={submit}>
          <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
          <div>
            <label className="label">Your name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Roofing company name</label>
            <input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
          </div>
          {error && <ErrorNote message={error} />}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <p className="text-center text-sm text-slate-500">
            Already have an account? <Link to="/login" className="text-brand-600">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
