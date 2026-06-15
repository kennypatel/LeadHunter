// AI provider abstraction. Every method has a deterministic fallback so the
// product keeps working when no API key is configured or the provider errors.
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import {
  scoreLead,
  ScoreableLead,
  ScoreResult,
} from '../../utils/scoring';
import {
  buildTokens,
  getBuiltInTemplate,
  renderTemplate,
  Workflow,
  DraftContext,
} from '../../utils/templates';

export interface DraftRequest {
  workflow: Workflow;
  type: 'EMAIL' | 'SMS';
  context: DraftContext;
  history?: string[]; // prior message snippets for personalization
}

export interface DraftResult {
  subject?: string;
  body: string;
  generatedBy: 'ai' | 'template';
}

export interface AiProvider {
  classifyLead(lead: ScoreableLead): Promise<ScoreResult>;
  draftMessage(req: DraftRequest): Promise<DraftResult>;
  summarizeHistory(history: string[]): Promise<string>;
  nextBestAction(lead: ScoreableLead & { name?: string }): Promise<string>;
}

// --- Template fallback (always available) ---------------------------------

function templateDraft(req: DraftRequest): DraftResult {
  const tmpl = getBuiltInTemplate(req.workflow, req.type);
  const tokens = buildTokens(req.context);
  if (!tmpl) {
    return { body: renderTemplate('Hi {{firstName}}, just following up!', tokens), generatedBy: 'template' };
  }
  return {
    subject: tmpl.subject ? renderTemplate(tmpl.subject, tokens) : undefined,
    body: renderTemplate(tmpl.body, tokens),
    generatedBy: 'template',
  };
}

class MockAiProvider implements AiProvider {
  async classifyLead(lead: ScoreableLead): Promise<ScoreResult> {
    return scoreLead(lead);
  }
  async draftMessage(req: DraftRequest): Promise<DraftResult> {
    return templateDraft(req);
  }
  async summarizeHistory(history: string[]): Promise<string> {
    if (!history.length) return 'No prior contact recorded.';
    return `Lead has ${history.length} prior interaction(s). Most recent: "${history[history.length - 1].slice(0, 140)}"`;
  }
  async nextBestAction(lead: ScoreableLead & { name?: string }): Promise<string> {
    const { score } = scoreLead(lead);
    const map: Record<string, string> = {
      HOT: 'Call now, then send an SMS within the hour.',
      WARM: 'Send a personalized follow-up email today.',
      COLD: 'Add to the next re-engagement batch.',
      STALE: 'Send one final re-engagement, then archive if no reply.',
      DEAD: 'Do not contact. Keep for records only.',
    };
    return map[score] ?? 'Review manually.';
  }
}

// --- OpenAI provider (used when AI_PROVIDER=openai and key present) --------
// Implemented with fetch to avoid an extra dependency. Falls back on any error.

class OpenAiProvider implements AiProvider {
  private fallback = new MockAiProvider();

  private async chat(system: string, user: string): Promise<string | null> {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.ai.apiKey}`,
        },
        body: JSON.stringify({
          model: env.ai.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.6,
        }),
      });
      if (!res.ok) {
        logger.warn('AI request failed, using fallback', { status: res.status });
        return null;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (err) {
      logger.error('AI request threw, using fallback', { err: String(err) });
      return null;
    }
  }

  async classifyLead(lead: ScoreableLead): Promise<ScoreResult> {
    // The score bucket stays deterministic; AI only enriches the reason text.
    const base = scoreLead(lead);
    const reason = await this.chat(
      'You are a roofing sales assistant. In one sentence, explain why this lead is the given score and what to do next. Be concrete.',
      `Score: ${base.score}\nSource: ${lead.source}\nStatus: ${lead.status}\nValue: ${lead.estimatedValue}\nNotes: ${lead.notesText ?? ''}`
    );
    return { score: base.score, reason: reason || base.reason };
  }

  async draftMessage(req: DraftRequest): Promise<DraftResult> {
    const fb = templateDraft(req);
    const channel = req.type === 'SMS' ? 'an SMS (max 320 chars, include "Reply STOP to opt out")' : 'a short email';
    const body = await this.chat(
      'You are a friendly roofing company assistant writing follow-ups to recover leads. Warm, concise, no hype, no false claims.',
      `Write ${channel} for the "${req.workflow}" workflow.\nLead: ${req.context.leadName}\nCompany: ${req.context.companyName}\nPhone: ${req.context.companyPhone}\nEstimate value: ${req.context.estimatedValue ?? 'n/a'}\nUse a natural greeting. Output only the message body.`
    );
    if (!body) return fb;
    return { subject: fb.subject, body, generatedBy: 'ai' };
  }

  async summarizeHistory(history: string[]): Promise<string> {
    if (!history.length) return 'No prior contact recorded.';
    const out = await this.chat(
      'Summarize this lead interaction history in 1-2 sentences for a busy roofing owner.',
      history.join('\n---\n')
    );
    return out || this.fallback.summarizeHistory(history);
  }

  async nextBestAction(lead: ScoreableLead & { name?: string }): Promise<string> {
    const out = await this.chat(
      'Give the single next best action for this roofing lead in one short imperative sentence.',
      JSON.stringify(lead)
    );
    return out || this.fallback.nextBestAction(lead);
  }
}

let provider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (provider) return provider;
  if (env.ai.provider === 'openai' && env.ai.apiKey) {
    provider = new OpenAiProvider();
  } else {
    provider = new MockAiProvider();
  }
  return provider;
}
