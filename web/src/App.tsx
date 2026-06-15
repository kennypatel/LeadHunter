import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { ReactNode } from 'react';

// Marketing
import Home from './pages/marketing/Home';
import Roofers from './pages/marketing/Roofers';
import Pricing from './pages/marketing/Pricing';
import CaseStudy from './pages/marketing/CaseStudy';
import GetAudit from './pages/marketing/GetAudit';
import BookCall from './pages/marketing/BookCall';
import Legal from './pages/marketing/Legal';

// Auth
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// App
import Dashboard from './pages/app/Dashboard';
import Leads from './pages/app/Leads';
import LeadDetail from './pages/app/LeadDetail';
import Approvals from './pages/app/Approvals';
import Onboarding from './pages/app/Onboarding';
import Admin from './pages/app/Admin';
import SalesTemplates from './pages/app/SalesTemplates';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public marketing */}
      <Route path="/" element={<Home />} />
      <Route path="/roofers" element={<Roofers />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/case-study" element={<CaseStudy />} />
      <Route path="/get-audit" element={<GetAudit />} />
      <Route path="/book" element={<BookCall />} />
      <Route path="/legal/:page" element={<Legal />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* App (protected) */}
      <Route path="/app" element={<Protected><Dashboard /></Protected>} />
      <Route path="/app/leads" element={<Protected><Leads /></Protected>} />
      <Route path="/app/leads/:id" element={<Protected><LeadDetail /></Protected>} />
      <Route path="/app/approvals" element={<Protected><Approvals /></Protected>} />
      <Route path="/app/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route path="/app/sales-templates" element={<Protected><SalesTemplates /></Protected>} />
      <Route path="/app/admin" element={<Protected><Admin /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
