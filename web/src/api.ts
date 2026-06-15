// Thin fetch wrapper. Uses cookie auth (credentials: include) and also accepts
// a bearer token persisted in localStorage as a fallback.

export interface ApiError {
  error: string;
  details?: unknown;
}

function token(): string | null {
  return localStorage.getItem('lh_token');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  // Guard against non-JSON bodies (proxy HTML error pages, gateway 502s) so the
  // real HTTP status surfaces instead of an "Unexpected token <" parse error.
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      throw new Error('Unexpected non-JSON response from server');
    }
  }
  if (!res.ok) {
    throw new Error((data as ApiError)?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
  setToken: (t: string | null) => (t ? localStorage.setItem('lh_token', t) : localStorage.removeItem('lh_token')),
};

// ---- Shared types (mirror backend) ----
export type Role = 'ADMIN' | 'CLIENT' | 'VIEWER';
export interface User {
  id: string;
  email: string;
  name?: string;
  role: Role;
  companyId: string | null;
  company?: Company | null;
}
export interface Company {
  id: string;
  name: string;
  phone?: string | null;
  serviceArea?: string | null;
  address?: string | null;
  email?: string | null;
  website?: string | null;
  calendarLink?: string | null;
  autoSendEnabled?: boolean;
}
export type LeadStatus = 'NEW' | 'CONTACTED' | 'RESPONDING' | 'ESTIMATE' | 'BOOKED' | 'CLOSED';
export type LeadScore = 'HOT' | 'WARM' | 'COLD' | 'STALE' | 'DEAD';
export interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status: LeadStatus;
  score: LeadScore;
  scoreReason?: string | null;
  estimatedValue: number;
  tags: string[];
  unsubscribed: boolean;
  consentEmail: boolean;
  consentSms: boolean;
  lastContactedAt?: string | null;
  createdAt: string;
}
export interface Message {
  id: string;
  type: 'EMAIL' | 'SMS';
  status: string;
  subject?: string | null;
  content: string;
  generatedBy?: string | null;
  createdAt: string;
  lead?: { name: string; email?: string | null; phone?: string | null; score?: LeadScore };
}
export interface DashboardStats {
  leadsTotal: number;
  leadsContacted: number;
  responses: number;
  bookedEstimates: number;
  pendingApprovals: number;
  failedSends: number;
  avgJobValue: number;
  recoveredRevenue: number;
  responseRate: number;
  bookingRate: number;
  scoreBreakdown: Record<string, number>;
}
