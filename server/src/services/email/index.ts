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

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  provider = env.email.provider === 'smtp' ? new SmtpEmailProvider() : new ConsoleEmailProvider();
  return provider;
}
