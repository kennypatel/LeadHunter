import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { ErrorNote } from '../../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/app');
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
          <h1 className="text-xl font-bold text-slate-900">Log in</h1>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <ErrorNote message={error} />}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          <p className="text-center text-sm text-slate-500">
            New here? <Link to="/register" className="text-brand-600">Create an account</Link>
          </p>
          <p className="rounded-md bg-slate-50 p-2 text-center text-xs text-slate-400">
            Demo: admin@leakhunter.app / admin1234 · owner@gsroofing.example / client1234
          </p>
        </form>
      </div>
    </div>
  );
}
