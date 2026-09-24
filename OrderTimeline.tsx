import { Check, X } from 'lucide-react';
import type { Order } from '@/types';
import { cls, PAYMENT_LABELS } from '@/utils/format';

/** Customer-facing progress: Order Placed → Payment → Processing → Ready/Dispatched → Delivered */
export function OrderTimeline({ order }: { order: Order }) {
  const cancelled = order.orderStatus === 'cancelled' || order.paymentStatus === 'cancelled';
  const failed = order.paymentStatus === 'failed';
  const orderRank: Record<string, number> = { placed: 0, processing: 2, ready: 3, dispatched: 3, delivered: 4, cancelled: -1 };
  const paid = order.paymentStatus === 'paid';
  const rank = paid ? Math.max(orderRank[order.orderStatus] ?? 0, 1) : 0;
  const steps = [
    { label: 'Order Placed', done: true },
    { label: paid ? 'Payment Verified' : PAYMENT_LABELS[order.paymentStatus], done: paid, current: !paid, bad: failed || cancelled },
    { label: 'Order Processing', done: rank >= 2, current: paid && rank === 1 },
    { label: order.orderStatus === 'dispatched' ? 'Dispatched' : 'Ready / Dispatched', done: rank >= 3, current: rank === 2 },
    { label: 'Delivered', done: rank >= 4, current: rank === 3 },
  ];
  if (cancelled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-cream-200 px-4 py-3.5 text-sm text-cocoa-100" data-testid="status-cancelled">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-cocoa/10"><X className="h-4 w-4" /></span>
        Order Cancelled
      </div>
    );
  }
  return (
    <ol className="relative grid gap-0 sm:grid-cols-5" data-testid="order-timeline">
      {steps.map((s, i) => (
        <li key={i} className="relative flex items-center gap-3 pb-5 sm:flex-col sm:items-start sm:gap-2.5 sm:pb-0 sm:pr-3">
          {i < steps.length - 1 && <span className={cls('absolute left-[13px] top-7 h-[calc(100%-20px)] w-px sm:left-7 sm:top-[13px] sm:h-px sm:w-[calc(100%-28px)]', s.done ? 'bg-gold' : 'bg-cocoa/10')} />}
          <span className={cls('relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] ring-4 ring-pearl',
            s.bad ? 'bg-danger text-white' : s.done ? 'bg-gold text-ink' : s.current ? 'bg-pearl text-gold-deep ring-gold/30 border border-gold' : 'bg-beige text-cocoa-50')}>
            {s.bad ? <X className="h-3.5 w-3.5" /> : s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={cls('text-[13px]', s.done || s.current ? 'font-medium text-cocoa' : 'text-cocoa-50', s.bad && 'text-danger')}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
