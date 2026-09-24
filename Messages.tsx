import { useState } from 'react';
import { Mail, Phone, Trash2, MessageSquare, CheckCheck, Circle } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { OwnerPageHeader } from '@/layouts/OwnerLayout';
import { ConfirmDialog, EmptyState, ErrorNote, Skeleton } from '@/components/ui';
import { cls, formatDate } from '@/utils/format';

interface Msg { id: number; name: string; email: string; phone: string | null; message: string; isRead: boolean; createdAt: string }

export default function Messages() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { data, setData, loading, error, reload } = useApi<Msg[]>(`/api/owner/messages${filter === 'unread' ? '?filter=unread' : ''}`);
  const { toast } = useToast();
  const [del, setDel] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);

  const mark = async (m: Msg, isRead: boolean) => {
    try {
      await api(`/api/owner/messages/${m.id}`, { method: 'PUT', body: { isRead } });
      setData((d) => d && (filter === 'unread' && isRead ? d.filter((x) => x.id !== m.id) : d.map((x) => (x.id === m.id ? { ...x, isRead } : x))));
      toast(isRead ? 'Marked as read.' : 'Marked as unread.', 'info');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try { await api(`/api/owner/messages/${del.id}`, { method: 'DELETE' }); setData((d) => d && d.filter((x) => x.id !== del.id)); toast('Message deleted.'); setDel(null); } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div>
      <OwnerPageHeader title="Customer Messages" sub="Messages sent from the Contact page."
        action={<div className="flex gap-2">{(['all', 'unread'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cls('chip', filter === f && 'chip-active')}>{f === 'all' ? 'All' : 'Unread'}</button>)}</div>} />
      {error && <ErrorNote message={error} onRetry={() => reload()} />}
      {loading && !data ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div> : data && data.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-5 w-5" />} title={filter === 'unread' ? 'No unread messages' : 'No messages yet'} text="Messages from your Contact page will appear here." />
      ) : (
        <div className="space-y-3">
          {data?.map((m) => (
            <article key={m.id} className={cls('card p-5', !m.isRead && 'ring-1 ring-gold/40')} data-testid={`card-message-${m.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium">{!m.isRead && <span className="h-2 w-2 rounded-full bg-gold" aria-label="Unread" />}{m.name}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-cocoa-100">
                    <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 hover:text-gold-dark"><Mail className="h-3.5 w-3.5" />{m.email}</a>
                    {m.phone && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1.5 hover:text-gold-dark"><Phone className="h-3.5 w-3.5" />{m.phone}</a>}
                  </p>
                </div>
                <p className="text-[12.5px] text-cocoa-50">{formatDate(m.createdAt)}</p>
              </div>
              <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-cocoa-200">{m.message}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => mark(m, !m.isRead)} className="btn-outline btn-sm" data-testid={`button-mark-read-${m.id}`}>{m.isRead ? <><Circle className="h-3.5 w-3.5" /> Mark unread</> : <><CheckCheck className="h-3.5 w-3.5" /> Mark as read</>}</button>
                <button onClick={() => setDel(m)} className="btn-ghost btn-sm text-danger" data-testid={`button-delete-message-${m.id}`}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!del} title="Delete message?" text={`The message from ${del?.name} will be permanently deleted.`} busy={busy} onClose={() => setDel(null)} onConfirm={remove} />
    </div>
  );
}
