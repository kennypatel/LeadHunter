import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  // Auth
  jwtSecret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  cookieName: process.env.COOKIE_NAME ?? 'lh_token',
  // CORS / web origin
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:4000',
  // Public-facing web URL used in email footers (unsubscribe link). Defaults to
  // the first configured web origin.
  publicUrl: process.env.PUBLIC_URL ?? (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim(),
  // Physical mailing address for the CAN-SPAM footer when a company has none.
  businessAddress: process.env.BUSINESS_ADDRESS ?? '',
  // Providers (all optional — fall back to console/no-op in dev)
  ai: {
    provider: process.env.AI_PROVIDER ?? 'mock', // mock | openai
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
  },
  email: {
    provider: process.env.EMAIL_PROVIDER ?? 'console', // console | smtp
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? 'noreply@leakhunter.app',
  },
  sms: {
    provider: process.env.SMS_PROVIDER ?? 'console', // console | twilio
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    from: process.env.TWILIO_FROM ?? '',
  },
  // Frequency / safety limits
  maxMessagesPerLeadPerWeek: parseInt(process.env.MAX_MESSAGES_PER_LEAD_PER_WEEK ?? '3', 10),
  // Single-service deploy: when true, the API also serves the built web app so
  // the whole product runs from one host (and /api is same-origin).
  serveWeb: process.env.SERVE_WEB === 'true',
  webDistPath: process.env.WEB_DIST_PATH ?? path.resolve(__dirname, '../../../web/dist'),
  // First-run admin bootstrap (creates an ADMIN account if none exists).
  adminEmail: process.env.ADMIN_EMAIL ?? '',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  adminName: process.env.ADMIN_NAME ?? 'LeakHunter Admin',
};
