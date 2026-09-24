import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { cls, OWNER_PAYMENT_LABELS, PAYMENT_LABELS, ORDER_LABELS } from '@/utils/format';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={cls('animate-spin', className)} aria-hidden />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-cocoa-50" role="status">
      <Spinner className="h-6 w-6 text-gold" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cls('skeleton', className)} aria-hidden />;
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cocoa/15 bg-pearl/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-beige text-gold-deep">{icon}</div>}
      <h3 className="text-xl">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-sm text-cocoa-50">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-[#FBEFEC] px-4 py-3 text-sm text-danger" role="alert">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{message}</p>
      {onRetry && <button onClick={onRetry} className="font-medium underline underline-offset-2">Try again</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] animate-[fadeUp_.2s_ease_both]" onClick={onClose} />
      <div className={cls('relative flex max-h-[92vh] w-full animate-fadeUp flex-col rounded-t-2xl bg-pearl shadow-lift sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-md')}>
        <div className="flex items-center justify-between border-b border-cocoa/5 px-5 py-4">
          <h2 className="text-xl">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-cocoa-50 hover:bg-beige" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-cocoa/5 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel = 'Delete', onConfirm, onClose, busy, danger = true }: { open: boolean; title: string; text: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn-outline btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={cls(danger ? 'btn-danger' : 'btn-primary', 'btn-sm')} onClick={onConfirm} disabled={busy} data-testid="button-confirm">
          {busy && <Spinner />} {confirmLabel}
        </button>
      </>}>
      <p className="text-sm text-cocoa-100">{text}</p>
    </Modal>
  );
}

const PAY_TONE: Record<string, string> = {
  awaiting_payment: 'bg-beige text-cocoa-200 ring-cocoa/10',
  pending_verification: 'bg-[#FBF1DC] text-warning ring-warning/20',
  paid: 'bg-[#E7F0E4] text-success ring-success/20',
  failed: 'bg-[#FBEAE6] text-danger ring-danger/20',
  cancelled: 'bg-cream-200 text-cocoa-50 ring-cocoa/10',
};
const ORDER_TONE: Record<string, string> = {
  placed: 'bg-beige text-cocoa-200 ring-cocoa/10',
  processing: 'bg-[#F6EEDD] text-gold-dark ring-gold/25',
  ready: 'bg-[#EDF1F6] text-[#3D5A7A] ring-[#3D5A7A]/20',
  dispatched: 'bg-[#EDF1F6] text-[#3D5A7A] ring-[#3D5A7A]/20',
  delivered: 'bg-[#E7F0E4] text-success ring-success/20',
  cancelled: 'bg-cream-200 text-cocoa-50 ring-cocoa/10',
};

export function StatusBadge({ kind, status, owner }: { kind: 'payment' | 'order'; status: string; owner?: boolean }) {
  const label = kind === 'payment' ? (owner ? OWNER_PAYMENT_LABELS : PAYMENT_LABELS)[status] : ORDER_LABELS[status];
  const tone = (kind === 'payment' ? PAY_TONE : ORDER_TONE)[status] || 'bg-beige text-cocoa';
  return <span data-testid={`status-${kind}`} className={cls('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium ring-1', tone)}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{label || status}</span>;
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string | null; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cls('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[12px] text-cocoa-50">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cls('input', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cls('input min-h-[110px] resize-y', p.className)} />;
export const Select = ({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cls('input appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236E5A4B%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[right_0.9rem_center] bg-no-repeat pr-9', p.className)}>{children}</select>
);

export function Toggle({ checked, onChange, label, description, testId, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string; testId?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} data-testid={testId} onClick={() => onChange(!checked)} className="flex items-start gap-3 text-left text-sm text-cocoa-200 disabled:opacity-50">
      <span className={cls('relative mt-px h-[22px] w-10 shrink-0 rounded-full transition', checked ? 'bg-gold' : 'bg-cocoa/15')}>
        <span className={cls('absolute top-[3px] h-4 w-4 rounded-full bg-pearl shadow transition-all', checked ? 'left-[21px]' : 'left-[3px]')} />
      </span>
      {(label || description) && <span className="min-w-0"><span className="block">{label}</span>{description && <span className="mt-0.5 block text-[12px] text-cocoa-50">{description}</span>}</span>}
    </button>
  );
}

export function SectionHeading({ eyebrow, title, action, className }: { eyebrow?: string; title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cls('mb-7 flex items-end justify-between gap-4', className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-[28px] leading-tight sm:text-[34px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Loads the video only when scrolled into view; uses poster until then. */
export function LazyVideo({ src, poster, className, autoPlay = false, controls = true, label }: { src: string; poster?: string | null; className?: string; autoPlay?: boolean; controls?: boolean; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisible(true);
      if (autoPlay && el.src) (e.isIntersecting ? el.play().catch(() => {}) : el.pause());
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [autoPlay, visible]);
  return (
    <video
      ref={ref}
      className={className}
      src={visible ? src : undefined}
      poster={poster || undefined}
      preload={visible ? 'metadata' : 'none'}
      muted={autoPlay}
      loop={autoPlay}
      autoPlay={autoPlay && visible}
      playsInline
      controls={controls}
      aria-label={label}
    />
  );
}
