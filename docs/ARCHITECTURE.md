# Architecture

LeakHunter is a TypeScript monorepo with two workspaces: a stateless Express API
(`server/`) backed by PostgreSQL via Prisma, and a React SPA (`web/`).

```
            ┌─────────────┐        /api (proxy in dev)        ┌──────────────┐
 Browser ──▶│  web (Vite) │ ───────────────────────────────▶ │ server (API) │
            └─────────────┘                                   └──────┬───────┘
                                                                     │ Prisma
                                              ┌──────────────────────▼─────────┐
                                              │         PostgreSQL              │
                                              └────────────────────────────────┘
   provider abstractions (swappable, default = safe/no-send):
     services/ai     → mock | openai
     services/email  → console | smtp
     services/sms    → console | twilio
```

## Layers (server)
1. **routes/** — thin HTTP handlers; validate input with Zod, enforce auth, call services.
2. **services/** — business logic and side effects:
   - `recovery` — classify leads, generate drafts into the approval queue, bulk runs.
   - `messaging` — the approval workflow + the send pipeline with the compliance gate.
   - `ai` / `email` / `sms` — provider abstractions with deterministic fallbacks.
   - `audit` — append-only audit log.
3. **utils/** — pure, dependency-free, unit-tested logic: `scoring`, `templates`,
   `roi`, `csv`. These never touch the DB or network, which keeps them trivially testable.
4. **lib/** — `prisma` singleton, `logger`.
5. **middleware/** — `auth` (JWT + RBAC + company scoping), `error`.

## Data model
`Company 1—* Lead`, with `Owner`, `Note`, `Task`, `Message`, `Pipeline` hanging
off the company/lead. `User` has a `Role` (ADMIN/CLIENT/VIEWER) and an optional
`companyId`. Compliance is modeled with `Consent`, `unsubscribed`/`consent*`
flags on `Lead`, and an immutable `AuditLog`. See
[`server/prisma/schema.prisma`](../server/prisma/schema.prisma).

## The send pipeline (safety core)
A message moves through explicit states:

```
DRAFT ─▶ PENDING_APPROVAL ─▶ APPROVED ─▶ QUEUED ─▶ SENT ─▶ DELIVERED/OPENED/CLICKED
                   │                          └─▶ FAILED ─(retry, <3)─▶ QUEUED
                   └─▶ REJECTED
```

`messaging.assertSendAllowed()` is the gate executed before every send. It blocks
on: unsubscribed lead, missing channel address, missing per-channel consent, and
the weekly frequency cap. The in-process scheduler (`index.ts`) calls
`processDueMessages()` every minute for scheduled/retry sends; replace it with a
real queue/cron worker at scale.

## Scoring
`utils/scoring.ts` deterministically buckets a lead (HOT/WARM/COLD/STALE/DEAD)
from age, source, status, and consent. The AI provider may enrich the *reason*
text but reuses the same buckets, so behavior stays predictable.

## Frontend
React Router with a `Protected` wrapper backed by an `AuthProvider`. `api.ts` is
a small fetch wrapper using cookie auth with a bearer-token fallback. Marketing
pages are fully public; `/app/*` requires a session.

## Trade-offs (MVP)
- In-process scheduler instead of a queue (simple, fine for a solo operator).
- AI score buckets stay rule-based for predictability; AI only writes copy/reasons.
- Email/SMS open/click tracking states exist in the model but require provider
  webhooks to populate; wire these up per provider in production.
