// Email provider abstraction. Default "console" provider logs instead of
// sending, so the app is safe to run locally without real credentials.
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<SendResult>;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<SendResult> {
    logger.info('[email:console] would send', { to: params.to, subject: params.subject });
    return { ok: true, providerId: `console-${Date.now()}` };
  }
}

// SMTP provider using nodemailer if available. We avoid a hard dependency:
// if SMTP is configured but nodemailer isn't installed, we log and fail safe.
class SmtpEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<SendResult> {
    try {
      // Dynamically required so the build doesn't require nodemailer in dev.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport({
        host: env.email.host,
        port: env.email.port,
        secure: env.email.port === 465,
        auth: { user: env.email.user, pass: env.email.pass },
        // Fail fast instead of hanging if the host blocks SMTP ports.
        connectionTimeout: 12000,
        greetingTimeout: 12000,
        socketTimeout: 15000,
      });
      const info = await transport.sendMail({
        from: params.from ?? env.email.from,
        to: params.to,
        subject: params.subject,
        text: params.body,
      });
      return { ok: true, providerId: info.messageId };
    } catch (err) {
      logger.error('[email:smtp] send failed', { err: String(err) });
      return { ok: false, error: String(err) };
    }
  }
}

// SendGrid via the HTTPS Web API (port 443) — works on hosts that block SMTP
// ports (e.g. Render's free tier). Needs SENDGRID_API_KEY and a verified sender.
class SendGridEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<SendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.email.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: params.from ?? env.email.from },
          subject: params.subject,
          content: [{ type: 'text/plain', value: params.body }],
        }),
        signal: controller.signal,
      });
      // SendGrid returns 202 Accepted with an empty body on success.
      if (res.status === 202) {
        return { ok: true, providerId: res.headers.get('x-message-id') ?? undefined };
      }
      const text = await res.text();
      logger.error('[email:sendgrid] send failed', { status: res.status, text: text.slice(0, 300) });
      return { ok: false, error: `SendGrid ${res.status}: ${text.slice(0, 200)}` };
    } catch (err) {
      logger.error('[email:sendgrid] threw', { err: String(err) });
      return { ok: false, error: String(err) };
    } finally {
      clearTimeout(timeout);
    }
  }
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  if (env.email.provider === 'sendgrid') provider = new SendGridEmailProvider();
  else if (env.email.provider === 'smtp') provider = new SmtpEmailProvider();
  else provider = new ConsoleEmailProvider();
  return provider;
}
