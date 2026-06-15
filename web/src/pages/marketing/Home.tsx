import { Link } from 'react-router-dom';
import { MarketingLayout } from '../../components/Layouts';

const STEPS = [
  { n: 1, title: 'We import your leads', body: 'Upload old quotes, missed calls, and web forms. We dedupe and organize everything in minutes.' },
  { n: 2, title: 'AI drafts the follow-ups', body: 'Personalized texts and emails for each lead — you review and approve before anything sends.' },
  { n: 3, title: 'You book more estimates', body: 'Recovered conversations turn into booked jobs. Weekly reports show the revenue you got back.' },
];

const BENEFITS = [
  'Recover revenue from leads you already paid for',
  'Never auto-send — every message is human-approved',
  'Missed-call recovery within minutes',
  'Built specifically for NJ roofing companies',
  'Unsubscribe + consent tracking baked in',
  'Weekly ROI reports in plain English',
];

const FAQ = [
  { q: 'Do you send messages automatically?', a: 'No. Every text and email goes to an approval queue. Nothing leaves until you (or your team) approves it.' },
  { q: 'Where do the leads come from?', a: 'Your own data — old quotes, missed calls, and web form fills. We help you recover the ones that slipped through.' },
  { q: 'Is this compliant?', a: 'We track consent per channel, honor unsubscribes immediately, and keep an audit log of every action.' },
  { q: 'How fast can I start?', a: 'Most roofers are live within a day: create an account, import a CSV, review the templates, and go.' },
];

export default function Home() {
  return (
    <MarketingLayout>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <span className="badge bg-brand-100 text-brand-700">For New Jersey Roofers</span>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">
            LeakHunter helps New Jersey roofers recover missed calls and old leads
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Recover lost revenue from leads you already paid for.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/get-audit" className="btn-primary px-6 py-3 text-base">Get Your Free Audit</Link>
            <Link to="/roofers" className="btn-secondary px-6 py-3 text-base">See the ROI calculator</Link>
          </div>
        </div>
      </section>

      {/* Social proof placeholder */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-center text-sm font-medium uppercase tracking-wide text-slate-400">
          Trusted by roofing crews across Essex, Union, Bergen & Middlesex County
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 opacity-60 md:grid-cols-4">
          {['Garden State Roofing', 'Summit Exteriors', 'Liberty Roof Co.', 'Shore Line Roofing'].map((c) => (
            <div key={c} className="rounded-lg border border-slate-100 bg-slate-50 py-6 text-center text-sm font-semibold text-slate-500">
              {c}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{s.n}</div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900">Why roofers use LeakHunter</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b} className="flex items-start gap-3">
              <span className="mt-0.5 text-brand-600">✓</span>
              <span className="text-slate-700">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">Frequently asked questions</h2>
          <div className="mt-8 space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="card">
                <h3 className="font-semibold text-slate-900">{f.q}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-700 py-16 text-center text-white">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-bold">Ready to recover lost revenue?</h2>
          <p className="mt-3 text-brand-100">Get a free audit of your missed calls and old leads.</p>
          <Link to="/get-audit" className="btn mt-6 bg-white px-6 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50">
            Get Your Free Audit
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
