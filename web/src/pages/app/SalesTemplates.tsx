import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/Layouts';
import { api } from '../../api';
import { Spinner, ErrorNote } from '../../components/ui';

interface SalesTemplate {
  id: string;
  category: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button className="btn-secondary text-xs" onClick={copy}>
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}

export default function SalesTemplates() {
  const [templates, setTemplates] = useState<SalesTemplate[]>([]);
  const [tokens, setTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ templates: SalesTemplate[]; tokens: string[] }>('/sales/templates')
      .then((d) => {
        setTemplates(d.templates);
        setTokens(d.tokens);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><Spinner /></AppLayout>;
  if (error) return <AppLayout><ErrorNote message={error} /></AppLayout>;

  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-900">Sales templates</h1>
      <p className="mt-1 text-sm text-slate-500">
        Polished outreach for signing roofing companies as clients. Copy, fill in the blanks, and send.
      </p>

      <div className="card mt-4 bg-slate-50">
        <p className="text-sm font-medium text-slate-700">Personalization tokens — replace before sending:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tokens.map((t) => (
            <code key={t} className="rounded bg-white px-2 py-1 text-xs text-brand-700">{t}</code>
          ))}
        </div>
      </div>

      {categories.map((cat) => (
        <section key={cat} className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">{cat}</h2>
          <div className="mt-3 space-y-4">
            {templates
              .filter((t) => t.category === cat)
              .map((t) => (
                <div key={t.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <span className="badge mt-1 bg-slate-100 text-slate-600">{t.channel}</span>
                    </div>
                    <CopyButton text={t.subject ? `Subject: ${t.subject}\n\n${t.body}` : t.body} />
                  </div>
                  {t.subject && (
                    <div className="mt-3 text-sm">
                      <span className="text-slate-400">Subject: </span>
                      <span className="font-medium text-slate-700">{t.subject}</span>
                    </div>
                  )}
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-700">{t.body}</pre>
                </div>
              ))}
          </div>
        </section>
      ))}
    </AppLayout>
  );
}
