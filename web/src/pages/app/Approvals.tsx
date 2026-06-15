import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/Layouts';
import { api, Message } from '../../api';
import { ScoreBadge, Spinner, ErrorNote } from '../../components/ui';

export default function Approvals() {
  const [queue, setQueue] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const { messages } = await api.get<{ messages: Message[] }>('/messages/queue');
      setQueue(messages);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(m: Message, sendNow: boolean) {
    setError('');
    try {
      const content = edits[m.id];
      const subject = edits[`${m.id}__subject`];
      const patch: Record<string, string> = {};
      if (content !== undefined && content !== m.content) patch.content = content;
      if (subject !== undefined && subject !== m.subject) patch.subject = subject;
      if (Object.keys(patch).length) {
        await api.patch(`/messages/${m.id}`, patch);
      }
      await api.post(`/messages/${m.id}/approve`, { sendNow });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reject(m: Message) {
    const reason = prompt('Reason for rejecting?') || 'Not a fit';
    await api.post(`/messages/${m.id}/reject`, { reason });
    load();
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-900">Approval queue</h1>
      <p className="mt-1 text-sm text-slate-500">
        Nothing is sent until you approve it. Edit the copy, then approve to queue or send now.
      </p>
      {error && <div className="mt-4"><ErrorNote message={error} /></div>}

      <div className="mt-6 space-y-4">
        {loading ? (
          <Spinner />
        ) : queue.length === 0 ? (
          <div className="card text-center text-slate-400">🎉 Approval queue is empty.</div>
        ) : (
          queue.map((m) => (
            <div key={m.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{m.lead?.name}</span>
                  {m.lead?.score && <ScoreBadge score={m.lead.score} />}
                  <span className="badge bg-slate-100 text-slate-600">{m.type}</span>
                  <span className="badge bg-purple-50 text-purple-700">{m.generatedBy ?? 'draft'}</span>
                </div>
                <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              {m.subject && (
                <input
                  className="input mt-3"
                  defaultValue={m.subject}
                  onChange={(e) => setEdits({ ...edits, [`${m.id}__subject`]: e.target.value })}
                />
              )}
              <textarea
                className="input mt-2"
                rows={3}
                defaultValue={m.content}
                onChange={(e) => setEdits({ ...edits, [m.id]: e.target.value })}
              />
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={() => approve(m, true)}>Approve &amp; send</button>
                <button className="btn-secondary" onClick={() => approve(m, false)}>Approve (queue)</button>
                <button className="btn-secondary text-red-600" onClick={() => reject(m)}>Reject</button>
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
