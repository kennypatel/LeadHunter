import { Link } from 'react-router-dom';
import { MarketingLayout } from '../../components/Layouts';

const TIERS = [
  {
    name: 'Starter',
    price: '$500',
    unit: 'one-time audit',
    highlight: false,
    features: ['Full lead-leak audit', 'Import up to 250 leads', '1 recovery campaign', 'Recovery plan + report'],
  },
  {
    name: 'Growth',
    price: '$750',
    unit: '/month retainer',
    highlight: true,
    features: ['Everything in Starter', 'Ongoing recovery campaigns', 'Missed-call follow-up', 'Approval queue', 'Weekly ROI reports'],
  },
  {
    name: 'Performance',
    price: 'Custom',
    unit: 'retainer + % of recovered',
    highlight: false,
    features: ['Everything in Growth', 'Higher lead volume', 'Performance bonus on recovered revenue', 'Priority support'],
  },
];

export default function Pricing() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-slate-900">Simple pricing for roofers</h1>
          <p className="mt-3 text-lg text-slate-600">Start with an audit. Scale into a retainer when you see the revenue.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.name} className={`card flex flex-col ${t.highlight ? 'ring-2 ring-brand-600' : ''}`}>
              {t.highlight && <span className="badge mb-2 w-fit bg-brand-600 text-white">Most popular</span>}
              <h3 className="text-lg font-bold text-slate-900">{t.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-extrabold text-slate-900">{t.price}</span>
                <span className="ml-1 text-sm text-slate-500">{t.unit}</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-brand-600">✓</span>{f}</li>
                ))}
              </ul>
              <Link to="/get-audit" className={`mt-6 ${t.highlight ? 'btn-primary' : 'btn-secondary'}`}>Get started</Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-400">
          Launch/setup projects run $750–$1,250 depending on data volume. No long-term contracts.
        </p>
      </section>
    </MarketingLayout>
  );
}
