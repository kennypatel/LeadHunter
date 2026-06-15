# Deployment guide

## 1. Prerequisites
- PostgreSQL 16 (managed, e.g. RDS / Supabase / Neon / Railway)
- Node 20+ runtime (or Docker)
- A long random `JWT_SECRET`
- (Optional) SMTP, Twilio, and OpenAI credentials for real sending/AI

## 2. Environment
Set these on the API host (never commit secrets):

```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB?schema=public&sslmode=require
JWT_SECRET=<64+ random chars>
WEB_ORIGIN=https://app.yourdomain.com
APP_BASE_URL=https://api.yourdomain.com

# Turn on real providers when ready:
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=hello@yourdomain.com
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1...
```

> `nodemailer` (SMTP) and the Twilio REST integration ship with the server, so
> no extra packages are needed to send.

## Going live with real sending (safety-gated)

Even with real providers configured above, **no message is sent until you flip
the kill-switch feature flags** (all OFF by default). This is intentional so you
can wire and test providers without risk.

1. Configure `EMAIL_PROVIDER=smtp` / `SMS_PROVIDER=twilio` and credentials.
2. Set `PUBLIC_URL` (for email unsubscribe links) and `BUSINESS_ADDRESS`
   (CAN-SPAM footer).
3. In **Admin → Feature flags**, enable:
   - `live_sending` — master switch
   - `email_sending` — once your domain has SPF/DKIM/DMARC verified
   - `sms_sending` — **only after** A2P 10DLC registration and with per-lead
     SMS consent (TCPA). Leave OFF until then.
4. Point your Twilio number's inbound "A message comes in" webhook to
   `https://<api-host>/api/webhooks/twilio/sms` so STOP replies auto-unsubscribe
   leads. (Validate `X-Twilio-Signature` before exposing this publicly.)

Every approved email automatically gets a CAN-SPAM footer (sender name, mailing
address, unsubscribe link). Human approval is always required before send.

## 3. Database
```bash
npm --workspace server run db:generate
npm --workspace server run db:migrate   # prisma migrate deploy
npm --workspace server run db:seed      # optional: demo/admin data
```
Migrations live in `server/prisma/migrations/` and are committed, so
`migrate deploy` applies them reproducibly.

## 4. Build & run the API
```bash
npm install
npm --workspace server run build
node server/dist/index.js
```
Health check: `GET /api/health` returns DB + provider status (use it for your
load balancer / uptime monitor).

## 5. Frontend
```bash
npm --workspace web run build   # outputs web/dist
```
Serve `web/dist` from any static host (Netlify, Vercel, S3+CloudFront, Nginx).
Configure the host so `/api/*` proxies to the API origin, or set the API origin
via the Vite proxy / a reverse proxy. Ensure CORS `WEB_ORIGIN` matches the site.

## 6. Docker (all-in-one)
```bash
cp .env.example .env   # set JWT_SECRET (and providers)
docker compose up --build -d
docker compose exec api npm --workspace server run db:seed
```
`docker-compose.yml` runs Postgres + the API and applies migrations on boot.

## 7. Production checklist
- [ ] Strong `JWT_SECRET`, rotated and stored in a secret manager
- [ ] Postgres with TLS (`sslmode=require`) and automated backups
- [ ] `WEB_ORIGIN` locked to your real frontend origin (CORS)
- [ ] Real email/SMS providers configured and domains authenticated (SPF/DKIM)
- [ ] Replace the in-process scheduler with a managed cron/queue if volume grows
- [ ] Review and replace the sample Terms/Privacy/Compliance pages with counsel
- [ ] Confirm consent/right-to-contact for all imported leads (TCPA / CAN-SPAM)
- [ ] Set up log aggregation + uptime monitoring against `/api/health`
```
