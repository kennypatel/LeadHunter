import { MarketingLayout } from '../../components/Layouts';
import LeadForm from './LeadForm';

export default function GetAudit() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900">Get your free lead-leak audit</h1>
          <p className="mt-4 text-lg text-slate-600">
            Tell us a little about your roofing business and we'll show you how much revenue is hiding in your
            missed calls and old quotes.
          </p>
          <ul className="mt-6 space-y-3 text-slate-700">
            {['No obligation, no contract', 'See your recoverable revenue estimate', 'We never auto-send to your customers'].map((b) => (
              <li key={b} className="flex gap-2"><span className="text-brand-600">✓</span>{b}</li>
            ))}
          </ul>
        </div>
        <LeadForm source="get_audit" />
      </section>
    </MarketingLayout>
  );
}
