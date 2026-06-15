import { MarketingLayout } from '../../components/Layouts';
import { money } from '../../components/ui';

export default function CaseStudy() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-16">
        <span className="badge bg-brand-100 text-brand-700">Case study (template)</span>
        <h1 className="mt-3 text-4xl font-extrabold text-slate-900">
          How a NJ roofer recovered {money(74000)} in 30 days
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          This is a template case study you can adapt with real client numbers.
        </p>

        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
          {[
            ['480', 'old leads imported'],
            ['210', 'follow-ups drafted'],
            ['11', 'estimates booked'],
          ].map(([n, l]) => (
            <div key={l} className="card">
              <div className="text-3xl font-extrabold text-brand-700">{n}</div>
              <div className="mt-1 text-sm text-slate-500">{l}</div>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold">The problem</h2>
        <p className="mt-2 text-slate-600">
          The owner had years of quotes and missed calls sitting in a spreadsheet and a voicemail box. Nobody
          had time to work them, so they quietly went cold.
        </p>

        <h2 className="mt-8 text-2xl font-bold">What we did</h2>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-slate-600">
          <li>Imported and deduped 480 old leads from CSV.</li>
          <li>Scored every lead (hot / warm / cold / stale) automatically.</li>
          <li>AI drafted personalized SMS + email follow-ups per lead.</li>
          <li>Owner approved messages in batches — nothing sent automatically.</li>
          <li>Tracked responses and booked estimates in the dashboard.</li>
        </ul>

        <h2 className="mt-8 text-2xl font-bold">The result</h2>
        <p className="mt-2 text-slate-600">
          11 booked estimates and roughly {money(74000)} in recovered pipeline in the first month — from leads
          the business had already paid to generate.
        </p>

        <blockquote className="mt-10 border-l-4 border-brand-600 bg-brand-50 p-6 text-lg italic text-slate-700">
          “I didn't need more leads. I needed to stop losing the ones I had.”
        </blockquote>
      </article>
    </MarketingLayout>
  );
}
