import { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-extrabold text-brand-700">
            Leak<span className="text-slate-900">Hunter</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <Link to="/roofers" className="hover:text-brand-600">For Roofers</Link>
            <Link to="/pricing" className="hover:text-brand-600">Pricing</Link>
            <Link to="/case-study" className="hover:text-brand-600">Case Study</Link>
            <Link to="/book" className="hover:text-brand-600">Book a Call</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand-600">Log in</Link>
            <Link to="/get-audit" className="btn-primary">Get Your Free Audit</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-20 border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-slate-500 md:flex-row md:justify-between">
          <div>
            <div className="font-bold text-slate-700">LeakHunter</div>
            <p className="mt-1 max-w-xs">Revenue recovery for New Jersey roofing companies.</p>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              <Link to="/legal/terms">Terms</Link>
              <Link to="/legal/privacy">Privacy</Link>
            </div>
            <div className="flex flex-col gap-1">
              <Link to="/legal/compliance">Compliance</Link>
              <Link to="/legal/unsubscribe">Unsubscribe</Link>
            </div>
          </div>
        </div>
        <div className="px-4 pb-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} LeakHunter. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

const NAV = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/leads', label: 'Leads' },
  { to: '/app/approvals', label: 'Approvals' },
  { to: '/app/onboarding', label: 'Onboarding' },
  { to: '/app/settings', label: 'Settings' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
          <Link to="/app" className="block px-2 text-lg font-extrabold text-brand-700">
            Leak<span className="text-slate-900">Hunter</span>
          </Link>
          <nav className="mt-6 flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            {user?.role === 'ADMIN' && (
              <>
                <NavLink
                  to="/app/sales-templates"
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-medium ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  Sales Templates
                </NavLink>
                <NavLink
                  to="/app/admin"
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-medium ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  Admin
                </NavLink>
              </>
            )}
          </nav>
        </aside>
        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <div className="text-sm text-slate-500">
              {user?.company?.name ?? (user?.role === 'ADMIN' ? 'Operator Console' : 'LeakHunter')}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{user?.email}</span>
              <span className="badge bg-brand-50 text-brand-700">{user?.role}</span>
              <button
                className="btn-secondary"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                Log out
              </button>
            </div>
          </header>
          <main className="mx-auto max-w-6xl p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
