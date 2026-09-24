import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Film, Trash2, RefreshCw, ArrowLeft, ArrowRight, GripVertical, UploadCloud, Play, AlertCircle } from 'lucide-react';
import { cls } from '@/utils/format';
import { mediaUrl } from '@/services/api';
import { ConfirmDialog, Spinner } from '@/components/ui';

export interface ManagedItem { id: number; kind: 'image' | 'video'; url: string; thumbUrl?: string | null; posterUrl?: string | null }
export interface PendingUpload { key: string; name: string; kind: 'image' | 'video'; progress: number; preview?: string; error?: string }

export const IMAGE_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mov';
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export function classifyFile(f: File): 'image' | 'video' | null {
  if (IMAGE_TYPES.includes(f.type)) return 'image';
  if (VIDEO_TYPES.includes(f.type) || /\.mov$/i.test(f.name)) return 'video';
  return null;
}

/** Drop zone + OS file/gallery picker. Never asks for URLs. */
export function DropZone({ accept, multiple = true, onFiles, label, sub, icon = 'image', testId, disabled }: { accept: string; multiple?: boolean; onFiles: (files: File[]) => void; label: string; sub: string; icon?: 'image' | 'video' | 'both'; testId?: string; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  const Icon = icon === 'video' ? Film : icon === 'both' ? UploadCloud : ImagePlus;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cls('flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-7 text-center transition', over ? 'border-gold bg-gold/5' : 'border-cocoa/15 bg-cream/60', disabled && 'opacity-60')}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-beige text-gold-deep"><Icon className="h-5 w-5" /></span>
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="btn-primary btn-sm px-5" data-testid={testId}>
        {label}
      </button>
      <p className="text-[12.5px] text-cocoa-50"><span className="hidden sm:inline">or drag & drop here · </span>{sub}</p>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
        data-testid={testId ? `${testId}-input` : undefined}
      />
    </div>
  );
}

function ProgressTile({ p }: { p: PendingUpload }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-beige ring-1 ring-cocoa/10" data-testid="upload-progress">
      {p.preview && p.kind === 'image' && <img src={p.preview} alt="" className="h-full w-full object-cover opacity-60" />}
      {p.kind === 'video' && <div className="grid h-full w-full place-items-center bg-cocoa/80"><Film className="h-6 w-6 text-cream/70" /></div>}
      <div className="absolute inset-x-2 bottom-2">
        {p.error ? (
          <p className="flex items-center gap-1 rounded-md bg-danger/90 px-2 py-1 text-[11px] text-white"><AlertCircle className="h-3 w-3" /> Failed</p>
        ) : (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-pearl/70"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${p.progress}%` }} /></div>
            <p className="mt-1 text-center text-[11px] font-medium text-cocoa">{p.progress < 100 ? `${p.progress}%` : 'Processing…'}</p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Manages already-uploaded media: preview, delete (with confirm), replace, reorder
 * (drag on desktop, arrow buttons on touch devices).
 */
export function MediaGrid({ items, pending = [], onDelete, onReplace, onReorder, emptyText, replaceAccept }: {
  items: ManagedItem[];
  pending?: PendingUpload[];
  onDelete: (id: number) => Promise<void>;
  onReplace?: (id: number, file: File) => Promise<void>;
  onReorder?: (ids: number[]) => Promise<void>;
  emptyText?: string;
  replaceAccept?: string;
}) {
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<number | null>(null);
  useEffect(() => setOrder(items), [items]);

  const commit = async (next: ManagedItem[]) => {
    setOrder(next);
    if (onReorder) await onReorder(next.map((i) => i.id));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };
  const onDrop = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const from = order.findIndex((i) => i.id === dragId);
    const to = order.findIndex((i) => i.id === targetId);
    const next = [...order];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setDragId(null);
    commit(next);
  };

  if (!order.length && !pending.length) return <p className="rounded-xl bg-cream/70 px-4 py-6 text-center text-[13.5px] text-cocoa-50">{emptyText || 'Nothing uploaded yet.'}</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {order.map((it, idx) => (
          <div
            key={it.id}
            draggable={!!onReorder}
            onDragStart={() => setDragId(it.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(it.id)}
            className={cls('group relative aspect-square overflow-hidden rounded-xl bg-beige ring-1 ring-cocoa/10 transition', dragId === it.id && 'opacity-40')}
            data-testid={`media-item-${it.id}`}
          >
            {it.kind === 'image' ? (
              <img src={mediaUrl(it.thumbUrl || it.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : it.posterUrl ? (
              <div className="relative h-full w-full"><img src={mediaUrl(it.posterUrl)} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-ink/25"><Play className="h-7 w-7 fill-cream text-cream" /></span></div>
            ) : (
              <video src={mediaUrl(it.url)} preload="metadata" muted playsInline className="h-full w-full bg-ink object-cover" />
            )}
            {idx === 0 && <span className="absolute left-2 top-2 rounded-full bg-cocoa/85 px-2 py-0.5 text-[10.5px] tracking-wide text-cream">COVER</span>}
            <span className="absolute right-2 top-2 rounded-full bg-pearl/90 px-2 py-0.5 text-[10.5px] text-cocoa-200">{it.kind === 'video' ? 'Video' : `#${idx + 1}`}</span>
            {onReorder && <GripVertical className="absolute left-1/2 top-2 hidden h-4 w-4 -translate-x-1/2 text-pearl drop-shadow sm:group-hover:block" />}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink/80 to-transparent p-1.5 pt-6">
              <div className="flex gap-1">
                {onReorder && <IconAct label="Move earlier" onClick={() => move(idx, -1)} disabled={idx === 0}><ArrowLeft className="h-3.5 w-3.5" /></IconAct>}
                {onReorder && <IconAct label="Move later" onClick={() => move(idx, 1)} disabled={idx === order.length - 1}><ArrowRight className="h-3.5 w-3.5" /></IconAct>}
              </div>
              <div className="flex gap-1">
                {onReplace && (
                  <IconAct label="Replace" onClick={() => { replaceTarget.current = it.id; replaceInput.current?.click(); }} testId={`button-replace-${it.id}`}>
                    {busy === it.id ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </IconAct>
                )}
                <IconAct label="Delete" danger onClick={() => setConfirm(it.id)} testId={`button-delete-media-${it.id}`}><Trash2 className="h-3.5 w-3.5" /></IconAct>
              </div>
            </div>
          </div>
        ))}
        {pending.map((p) => <ProgressTile key={p.key} p={p} />)}
      </div>
      <input
        ref={replaceInput}
        type="file"
        className="hidden"
        accept={replaceAccept}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          const id = replaceTarget.current;
          if (!f || id === null || !onReplace) return;
          setBusy(id);
          try { await onReplace(id, f); } finally { setBusy(null); }
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        title="Delete media?"
        text="This file will be permanently removed from storage. This cannot be undone."
        busy={busy === confirm}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const id = confirm!;
          setBusy(id);
          try { await onDelete(id); } finally { setBusy(null); setConfirm(null); }
        }}
      />
    </>
  );
}

function IconAct({ children, label, onClick, disabled, danger, testId }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} data-testid={testId}
      className={cls('grid h-7 w-7 place-items-center rounded-full bg-pearl/95 text-cocoa shadow transition disabled:opacity-30', danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-gold hover:text-ink')}>
      {children}
    </button>
  );
}

/** Local-only staging for the Add Product page (before a product id exists). */
export interface StagedFile { key: string; file: File; kind: 'image' | 'video'; preview: string }
export function StagedGrid({ files, onChange }: { files: StagedFile[]; onChange: (f: StagedFile[]) => void }) {
  if (!files.length) return null;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= files.length) return;
    const n = [...files];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((s, i) => (
        <div key={s.key} className="relative aspect-square overflow-hidden rounded-xl bg-beige ring-1 ring-cocoa/10" data-testid="staged-file">
          {s.kind === 'image' ? <img src={s.preview} alt="" className="h-full w-full object-cover" /> : <video src={s.preview} muted playsInline preload="metadata" className="h-full w-full bg-ink object-cover" />}
          {i === 0 && s.kind === 'image' && <span className="absolute left-2 top-2 rounded-full bg-cocoa/85 px-2 py-0.5 text-[10.5px] text-cream">COVER</span>}
          <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-ink/80 to-transparent p-1.5 pt-6">
            <div className="flex gap-1">
              <IconAct label="Move earlier" onClick={() => move(i, -1)} disabled={i === 0}><ArrowLeft className="h-3.5 w-3.5" /></IconAct>
              <IconAct label="Move later" onClick={() => move(i, 1)} disabled={i === files.length - 1}><ArrowRight className="h-3.5 w-3.5" /></IconAct>
            </div>
            <IconAct label="Remove" danger onClick={() => { URL.revokeObjectURL(s.preview); onChange(files.filter((f) => f.key !== s.key)); }}><Trash2 className="h-3.5 w-3.5" /></IconAct>
          </div>
        </div>
      ))}
    </div>
  );
}
