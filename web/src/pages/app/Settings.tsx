import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/Layouts';
import { useAuth } from '../../auth';
import { api, Company } from '../../api';
import { ErrorNote } from '../../components/ui';

export default function Settings() {
  const { user, refresh } = useAuth();

  // Profile (your name — used as the sender in sales drafts)
  const [name, setName] = useState(user?.name ?? '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Company
  const [company, setCompany] = useState<Partial<Company>>(user?.company ?? {});
  const [companyMsg, setCompanyMsg] = useState('');
  const [companyErr, setCompanyErr] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    if (user?.company) setCompany(user.company);
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setSavingProfile(true);
    try {
      await api.patch('/auth/profile', { name });
      await refresh();
      setProfileMsg('Saved.');
    } catch (err) {
      setProfileErr((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setCompanyMsg('');
    setCompanyErr('');
    if (!user?.companyId) {
      setCompanyErr('No company yet. Create one from the Leads page first.');
      return;
    }
    setSavingCompany(true);
    try {
      await api.patch(`/companies/${user.companyId}`, {
        name: company.name,
        phone: company.phone ?? '',
        serviceArea: company.serviceArea ?? '',
        address: company.address ?? '',
        email: company.email ?? '',
        website: company.website ?? '',
        calendarLink: company.calendarLink ?? '',
      });
      await refresh();
      setCompanyMsg('Saved.');
    } catch (err) {
      setCompanyErr((err as Error).message);
    } finally {
      setSavingCompany(false);
    }
  }

  const field = (
    label: string,
    key: keyof Company,
    placeholder = '',
    type = 'text'
  ) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        placeholder={placeholder}
        value={(company[key] as string) ?? ''}
        onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Edit your company details and your sender info.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <form className="card space-y-4" onSubmit={saveProfile}>
          <h2 className="font-semibold text-slate-900">Your profile</h2>
          <div>
            <label className="label">Your name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            <p className="mt-1 text-xs text-slate-400">Used as the sender name in your outreach drafts.</p>
          </div>
          <div>
            <label className="label">Email (login)</label>
            <input className="input bg-slate-50" value={user?.email ?? ''} disabled />
          </div>
          {profileErr && <ErrorNote message={profileErr} />}
          {profileMsg && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{profileMsg}</div>}
          <button className="btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
        </form>

        {/* Company */}
        <form className="card space-y-4" onSubmit={saveCompany}>
          <h2 className="font-semibold text-slate-900">Company</h2>
          <div>
            <label className="label">Company name</label>
            <input
              className="input"
              value={company.name ?? ''}
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
              required
            />
          </div>
          {field('Phone', 'phone')}
          {field('Service area', 'serviceArea', 'e.g. Essex County, NJ')}
          {field('Address', 'address', 'Used in the email footer (CAN-SPAM)')}
          {field('Email', 'email', '', 'email')}
          {field('Website', 'website')}
          {field('Calendar / booking link', 'calendarLink', 'e.g. https://calendly.com/you')}
          {companyErr && <ErrorNote message={companyErr} />}
          {companyMsg && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{companyMsg}</div>}
          <button className="btn-primary" disabled={savingCompany}>{savingCompany ? 'Saving…' : 'Save company'}</button>
        </form>
      </div>
    </AppLayout>
  );
}
