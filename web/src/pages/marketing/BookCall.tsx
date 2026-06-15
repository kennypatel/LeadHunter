import { MarketingLayout } from '../../components/Layouts';
import LeadForm from './LeadForm';

export default function BookCall() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900">Book a 15-minute call</h1>
        <p className="mt-3 text-lg text-slate-600">
          Pick a time that works and we'll walk through your lead recovery opportunity.
        </p>
        {/* Drop your scheduling embed (Calendly, SavvyCal, etc.) here. */}
        <div className="card mt-8 flex h-64 items-center justify-center text-slate-400">
          <div>
            <p className="font-medium">[ Scheduling widget goes here ]</p>
            <p className="mt-1 text-sm">Set <code>VITE_BOOKING_URL</code> or embed your Calendly link.</p>
          </div>
        </div>
        <div className="mt-10 text-left">
          <h2 className="text-xl font-bold">Prefer we reach out?</h2>
          <p className="mt-1 text-slate-600">Leave your details and we'll call you.</p>
          <div className="mt-4"><LeadForm source="book_call" /></div>
        </div>
      </section>
    </MarketingLayout>
  );
}
