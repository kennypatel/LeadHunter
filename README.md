# LeakHunter

**Revenue-recovery system for New Jersey roofing companies.** LeakHunter helps
roofers recover lost revenue from missed calls, old quotes, and unanswered
estimates — leads they already paid for. It captures and scores leads, drafts
personalized follow-ups with AI, routes every message through a **human approval
queue** before sending, tracks every interaction, and reports recovered revenue.

> Core safety principle: **nothing is sent automatically.** Every outbound
> email/SMS is drafted, reviewed, and approved by a human. Consent, unsubscribe,
> frequency limits, and audit logging are enforced server-side.

---

## Table of contents
- [Stack](#stack)
- [Features by module](#features-by-module)
- [Quick start (local)](#quick-start-local)
- [Quick start (Docker)](#quick-start-docker)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [Project structure](#project-structure)
- [Testing](#testing)
- [API overview](#api-overview)
- [Provider abstractions](#provider-abstractions)
- [Compliance & safety](#compliance--safety)
- [Deployment](#deployment)

---

## Stack
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Frontend:** React + Vite + Tailwind CSS
- **Auth:** JWT (httpOnly cookie + bearer fallback), bcrypt, role-based access
- **AI / Email / SMS:** provider abstractions with safe deterministic fallbacks
- **Tests:** Jest (unit + supertest integration)
- **Deploy:** Docker / docker-compose

## Features by module
| Module | What's included |
| --- | --- |
| **Marketing site** | Home, Roofers landing + ROI calculator, Pricing, Case study, Get-Audit lead capture, Book-a-call, Legal (Terms/Privacy/Compliance/Unsubscribe) |
| **Auth & roles** | Register, login, logout, `/me`, email verification token, password reset, ADMIN/CLIENT/VIEWER roles |
| **CRM** | Company, Owner, Lead, Note, Task, Message, Pipeline; CSV import with dedupe; tagging; search/filter; timeline view |
| **Lead recovery engine** | Rule + AI lead scoring (hot/warm/cold/stale/dead); workflow inference (missed-call / re-engage / estimate follow-up); draft generation; bulk recovery |
| **Messaging** | Email + SMS provider abstraction; approval workflow; scheduled send; retry logic; consent + frequency enforcement; full status tracking |
| **Dashboards** | Admin + client stats, recovered-revenue estimate, score breakdown, weekly report, CSV export |
| **AI features** | Classification + explanation, follow-up copy, history summary, next-best-action; all editable; template fallback if AI fails |
| **Admin tools** | Audit log viewer, failed-job retry, users CRUD, feature flags, JSON export, health check |
| **Onboarding** | 7-step guided flow with progress tracking |
| **Sales enablement** | Proposal + ROI summary generator, pilot/retainer offers, pricing tiers |

## Quick start (local)

Prerequisites: Node 20+, a running PostgreSQL 16.

```bash
# 1. Install
npm install

# 2. Configure the backend
cp server/.env.example server/.env
#   edit DATABASE_URL + JWT_SECRET in server/.env

# 3. Create schema + seed demo data
npm --workspace server run db:generate
npm --workspace server run db:migrate     # applies prisma/migrations
npm --workspace server run db:seed

# 4. Run both apps (API on :4000, web on :5173)
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the backend.

## Quick start (Docker)

```bash
cp .env.example .env       # set JWT_SECRET
docker compose up --build  # starts Postgres + API (migrations run on boot)
# then seed once:
docker compose exec api npm --workspace server run db:seed
```

The API is exposed on `:4000`. Build the web app with `npm --workspace web run
build` and serve `web/dist` from any static host (or point it at the API).

## Environment variables
See [`server/.env.example`](server/.env.example). Highlights:

| Var | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | — | Postgres connection string (required) |
| `JWT_SECRET` | dev value | **Set a long random secret in production** |
| `AI_PROVIDER` | `mock` | `mock` \| `openai` (uses `OPENAI_API_KEY`) |
| `EMAIL_PROVIDER` | `console` | `console` (logs) \| `smtp` |
| `SMS_PROVIDER` | `console` | `console` (logs) \| `twilio` |
| `MAX_MESSAGES_PER_LEAD_PER_WEEK` | `3` | Frequency cap enforced before every send |

All secrets come from environment variables — none are committed. With the
default `console`/`mock` providers the app runs fully without any third-party
credentials and never sends real messages.

## Demo accounts
After seeding:
- **Admin (operator):** `admin@leakhunter.app` / `admin1234`
- **Client (roofer):** `owner@gsroofing.example` / `client1234`

## Project structure
```
LeakHunter/
├── server/                 # Express + Prisma API
│   ├── prisma/             # schema, migrations, seed
│   ├── data/               # sample-leads.csv
│   └── src/
│       ├── config/         # env loading
│       ├── lib/            # prisma client, logger
│       ├── middleware/     # auth, error handling
│       ├── utils/          # scoring, templates, roi, csv (pure + unit-tested)
│       ├── services/       # ai, email, sms, messaging, recovery, audit
│       └── routes/         # auth, leads, companies, messages, dashboard, admin, public, sales
├── web/                    # React + Vite + Tailwind
│   └── src/
│       ├── pages/marketing # public site
│       ├── pages/auth      # login / register
│       └── pages/app       # dashboard, leads, approvals, onboarding, admin
├── docs/                   # ARCHITECTURE.md, DEPLOYMENT.md
└── docker-compose.yml
```

## Testing
```bash
npm test                       # backend Jest suite (unit + integration)
npm --workspace web run build  # type-checks + builds the frontend
```
Pure business logic (scoring, templates, ROI, CSV parsing/dedupe) is covered by
unit tests; the HTTP layer (auth gate, public ROI, validation) by supertest.

## API overview
All app routes are under `/api`. A few highlights:
- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- `GET/POST /api/leads`, `POST /api/leads/import`, `POST /api/leads/:id/draft`, `GET /api/leads/:id/insights`
- `GET /api/messages/queue`, `POST /api/messages/:id/approve`, `POST /api/messages/:id/reject`, `POST /api/messages/:id/send`
- `GET /api/dashboard`, `GET /api/dashboard/weekly-report`, `POST /api/dashboard/bulk-recovery`
- `GET /api/admin/audit`, `GET /api/admin/flags`, `POST /api/admin/retry-due`
- Public: `POST /api/public/leads`, `POST /api/public/roi-calculator`, `POST /api/public/unsubscribe`
- `GET /api/health` — DB + provider status

## Provider abstractions
`services/ai`, `services/email`, and `services/sms` each expose an interface with
a swappable implementation chosen by env var. Defaults are non-sending:
- **AI** `mock` → deterministic rule scoring + built-in templates. `openai` calls
  the Chat Completions API and **falls back to templates on any error**.
- **Email** `console` → logs instead of sending. `smtp` → nodemailer.
- **SMS** `console` → logs. `twilio` → Twilio REST API.

This makes the system safe to run and demo without credentials, and easy to wire
to real providers in production.

## Compliance & safety
- **Approval gates:** drafts land in `PENDING_APPROVAL`; nothing sends without a human.
- **Consent tracking:** per-channel email/SMS consent; sends blocked without it.
- **Unsubscribe:** public endpoint + footer link immediately opts a lead out and marks them DEAD.
- **Frequency limits:** configurable weekly cap enforced pre-send.
- **Audit log:** every draft, approval, send, failure, and opt-out is recorded.

## Deployment
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---
_This is an MVP built for a solo operator. Legal pages contain sample content —
review with counsel before production use, and ensure you have the right to
contact any leads you import (TCPA / CAN-SPAM)._
