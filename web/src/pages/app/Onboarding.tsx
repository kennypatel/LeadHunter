import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/Layouts';
import { useAuth } from '../../auth';
import { api } from '../../api';
import { ErrorNote } from '../../components/ui';

const STEPS = [
  { title: 'Create account', help: 'You already did this — nice work.' },
  { title: 'Add company details', help: 'Confirm your roofing company name, service area, and phone.' },
  { title: 'Upload old leads', help: 'Import a CSV of old quotes and missed calls. We dedupe automatically.' },
  { title: 'Connect email / SMS', help: 'Add SMTP or Twilio credentials in the server .env. Default uses safe console mode.' },
  { title: 'Review AI templates', help: 'Built-in missed-call, re-engage, and estimate follow-up templates are ready to edit.' },
  { title: 'Activate approval workflow', help: 'All outreach goes to the approval queue. Nothing sends without you.' },
  { title: 'Go live', help: 'Run a bulk recovery and start approving messages.' },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const companyId = user?.companyId;
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!companyId) return;
    try {
      const { onboarding } = await api.get<{ onboarding: { step: number; completed: boolean } | null }>(`/companies/${companyId}/onboarding`);
      if (onboarding) {
        setStep(onboarding.step);
        setCompleted(onboarding.completed);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function advance(to: number) {
    if (!companyId) {
      setError('Create your company first (step 2).');
      return;
    }
    const isDone = to > STEPS.length;
    const next = Math.min(to, STEPS.length);
    await api.patch(`/companies/${companyId}/onboarding`, { step: next, completed: isDone });
    setStep(next);
    if (isDone) setCompleted(true);
  }

  if (!companyId) {
    return (
      <AppLayout>
        <h1 className="text-2xl font-bold text-slate-900">Onboarding</h1>
        <div className="card mt-6">
          <p className="text-slate-600">You don't have a company yet. An admin can attach you to one, or finish registration with a company name.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-900">Onboarding</h1>
      <p className="mt-1 text-sm text-slate-500">{completed ? 'Setup complete — you can revisit any step.' : `Step ${step} of ${STEPS.length}`}</p>
      {error && <div className="mt-4"><ErrorNote message={error} /></div>}

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>

      <div className="mt-6 space-y-3">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = completed || n < step ? 'done' : n === step ? 'current' : 'todo';
          return (
            <div key={s.title} className={`card flex items-start gap-4 ${state === 'current' ? 'ring-2 ring-brand-500' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                state === 'done' ? 'bg-green-100 text-green-700' : state === 'current' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {state === 'done' ? '✓' : n}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.help}</p>
                {n === 3 && state === 'current' && (
                  <button className="btn-secondary mt-2" onClick={() => navigate('/app/leads')}>Go to import</button>
                )}
                {state === 'current' && (
                  <button className="btn-primary mt-2 ml-2" onClick={() => advance(n + 1)}>
                    {n === STEPS.length ? 'Finish' : 'Mark done & continue'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
