// SMS provider abstraction. Default "console" provider logs instead of sending.
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export interface SendSmsParams {
  to: string;
  body: string;
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export interface SmsProvider {
  send(params: SendSmsParams): Promise<SendResult>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(params: SendSmsParams): Promise<SendResult> {
    logger.info('[sms:console] would send', { to: params.to, len: params.body.length });
    return { ok: true, providerId: `console-${Date.now()}` };
  }
}

// Twilio via REST API (fetch) to avoid a hard SDK dependency.
class TwilioSmsProvider implements SmsProvider {
  async send(params: SendSmsParams): Promise<SendResult> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${env.sms.accountSid}/Messages.json`;
      const auth = Buffer.from(`${env.sms.accountSid}:${env.sms.authToken}`).toString('base64');
      const form = new URLSearchParams({ To: params.to, From: env.sms.from, Body: params.body });
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      if (!res.ok) {
        const text = await res.text();
        logger.error('[sms:twilio] send failed', { status: res.status, text });
        return { ok: false, error: `Twilio ${res.status}` };
      }
      const data = (await res.json()) as { sid?: string };
      return { ok: true, providerId: data.sid };
    } catch (err) {
      logger.error('[sms:twilio] threw', { err: String(err) });
      return { ok: false, error: String(err) };
    }
  }
}

let provider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (provider) return provider;
  provider = env.sms.provider === 'twilio' ? new TwilioSmsProvider() : new ConsoleSmsProvider();
  return provider;
}
