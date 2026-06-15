import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MarketingLayout } from '../../components/Layouts';
import { api } from '../../api';
import { ErrorNote } from '../../components/ui';

function Unsubscribe() {
  const [params] = useSearchParams();
  const [leadId, setLeadId] = useState(params.get('lead') ?? '');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/public/unsubscribe', { lead: leadId });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (done) {
    return <div className="card bg-green-50 text-green-800">You have been unsubscribed and will no longer be contacted.</div>;
  }
  return (
    <form className="card max-w-md space-y-4" onSubmit={submit}>
      <p className="text-slate-600">Enter your unsubscribe code (from the message footer) to opt out of all future contact.</p>
      <input className="input" placeholder="Lead / unsubscribe code" value={leadId} onChange={(e) => setLeadId(e.target.value)} required />
      {error && <ErrorNote message={error} />}
      <button className="btn-primary">Unsubscribe</button>
    </form>
  );
}

const CONTENT: Record<string, { title: string; body: JSX.Element }> = {
  terms: {
    title: 'Terms of Service',
    body: (
      <>
        <p>These sample Terms of Service govern your use of LeakHunter. Replace with your attorney-reviewed terms before launch.</p>
        <p>LeakHunter provides lead-recovery software. You are responsible for ensuring you have the legal right and consent to contact the leads you import, and for complying with the TCPA, CAN-SPAM, and applicable New Jersey regulations.</p>
        <p>LeakHunter routes all outbound messages through a human approval queue and does not send messages automatically unless explicitly enabled per client.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>This sample Privacy Policy describes how LeakHunter handles data. Replace with your reviewed policy before launch.</p>
        <p>We store the business and lead data you provide to deliver the service. We track message consent per channel and honor unsubscribe requests immediately. We maintain an audit log of actions taken in the system.</p>
        <p>We do not sell your data. Provider integrations (email/SMS/AI) process data only to deliver requested functionality.</p>
      </>
    ),
  },
  compliance: {
    title: 'Compliance',
    body: (
      <>
        <p>LeakHunter is built for safe, compliant outreach:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><b>Approval gates:</b> every message is reviewed by a human before sending.</li>
          <li><b>Consent tracking:</b> email and SMS consent are tracked per lead.</li>
          <li><b>Unsubscribe handling:</b> opt-outs are honored immediately and recorded.</li>
          <li><b>Frequency limits:</b> a configurable cap prevents over-messaging a lead.</li>
          <li><b>Audit logs:</b> every approval, send, and opt-out is logged.</li>
        </ul>
        <p>You remain responsible for TCPA / CAN-SPAM compliance and for the consent status of imported leads.</p>
      </>
    ),
  },
};

export default function Legal() {
  const { page } = useParams<{ page: string }>();

  if (page === 'unsubscribe') {
    return (
      <MarketingLayout>
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-3xl font-extrabold text-slate-900">Unsubscribe</h1>
          <div className="mt-6"><Unsubscribe /></div>
        </section>
      </MarketingLayout>
    );
  }

  const content = CONTENT[page ?? 'terms'] ?? CONTENT.terms;
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-extrabold text-slate-900">{content.title}</h1>
        <div className="prose mt-6 max-w-none space-y-4 text-slate-600">{content.body}</div>
        <p className="mt-10 text-xs text-slate-400">Last updated {new Date().toLocaleDateString()}. Sample content — review with counsel.</p>
      </section>
    </MarketingLayout>
  );
}
