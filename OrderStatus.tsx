import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Search, Copy } from 'lucide-react';
import { api, mediaUrl } from '@/services/api';
import type { OrderDetailResponse } from '@/types';
import { useSeo } from '@/hooks/useSeo';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { OrderTimeline } from '@/components/OrderTimeline';
import { PendingVerificationNote, UpiPaymentPanel } from '@/components/UpiPaymentPanel';
import { ErrorNote, Field, Input, PageLoader, Spinner, StatusBadge } from '@/components/ui';
import { formatDate, formatINR } from '@/utils/format';
import { safeStorage } from '@/utils/safeStorage';

const store = safeStorage('local');
export function rememberOrder(orderNumber: string, token: string) {
  try {
    const list = JSON.parse(store.get('mpr_orders') || '[]') as { n: string; t: string }[];
    store.set('mpr_orders', JSON.stringify([{ n: orderNumber, t: token }, ...list.filter((o) => o.n !== orderNumber)].slice(0, 10)));
  } catch {
    /* ignore */
  }
}
export function recentOrders(): { n: string; t: string }[] {
  try {
    return JSON.parse(store.get('mpr_orders') || '[]');
  } catch {
    return [];
  }
}

export default function OrderStatus() {
  const { orderNumber = '' } = useParams();
  const [sp] = useSearchParams();
  const { customer } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const token = sp.get('t') || recentOrders().find((o) => o.n === orderNumber)?.t || '';
  const phone = sp.get('phone') || '';
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  useSeo(`Order ${orderNumber}`);

  const needsLookup = !token && !phone && !customer;
  const qs = token ? `token=${encodeURIComponent(token)}` : phone ? `phone=${encodeURIComponent(phone)}` : '';

  const load = useCallback(async (silent = false) => {
    if (needsLookup) return setLoading(false);
    if (!silent) setLoading(true);
    try {
      setData(await api<OrderDetailResponse>(`/api/orders/${orderNumber}?${qs}`));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orderNumber, qs, needsLookup]);

  useEffect(() => { load(); }, [load]);
  // Refresh periodically so owner verification appears without reloading
  useEffect(() => {
    if (!data || ['delivered', 'cancelled'].includes(data.order.orderStatus)) return;
    const t = setInterval(() => load(true), 20000);
    return () => clearInterval(t);
  }, [data, load]);

  const confirm = async (reference: string) => {
    setConfirming(true);
    try {
      const r = await api<OrderDetailResponse>(`/api/orders/${orderNumber}/confirm-payment`, { body: { token: token || undefined, phone: phone || undefined, reference: reference || undefined } });
      setData(r);
      toast('Payment confirmation submitted.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast('Payment confirmation could not be submitted. Please try again.', 'error');
    } finally {
      setConfirming(false);
    }
  };

  if (needsLookup) return <TrackOrder initialOrder={orderNumber} />;
  if (loading) return <PageLoader label="Loading your order…" />;
  if (error || !data) return <div className="container-lux max-w-2xl py-16"><ErrorNote message={error || 'Order not found.'} /><div className="mt-6"><TrackOrderForm initialOrder={orderNumber} onFound={(n, p) => nav(`/order/${n}?phone=${p}`)} /></div></div>;

  const { order, paymentInstructions } = data;
  const ps = order.paymentStatus;

  return (
    <div className="container-lux max-w-4xl pt-10 sm:pt-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Order status</p>
          <h1 className="mt-2 flex items-center gap-3 text-[30px] sm:text-[36px]" data-testid="text-order-number">
            {order.orderNumber}
            <button onClick={() => { navigator.clipboard?.writeText(order.orderNumber).catch(() => {}); toast('Order ID copied.', 'info'); }} className="rounded-full p-1.5 text-cocoa-50 hover:bg-beige" aria-label="Copy order ID"><Copy className="h-4 w-4" /></button>
          </h1>
          <p className="mt-1 text-sm text-cocoa-50">Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-sm"><span className="text-cocoa-50">Status</span><StatusBadge kind="order" status={order.orderStatus} /></div>
          <div className="flex items-center gap-2 text-sm"><span className="text-cocoa-50">Payment</span><StatusBadge kind="payment" status={ps} /></div>
        </div>
      </div>

      <div className="card mt-7 p-5 sm:p-7"><OrderTimeline order={order} /></div>

      <div className="mt-6 space-y-6">
        {ps === 'pending_verification' && <PendingVerificationNote />}
        {ps === 'paid' && (
          <div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-[#EEF5EC] px-5 py-4" data-testid="note-payment-verified">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div><p className="font-medium">Payment Verified</p><p className="mt-0.5 text-[14px] text-cocoa-100">Thank you. MPR JEWELLERY has verified your payment{order.orderStatus !== 'placed' ? ' and your order is being prepared.' : '.'}</p></div>
          </div>
        )}
        {ps === 'failed' && (
          <div className="flex items-start gap-3 rounded-2xl border border-danger/25 bg-[#FBEFEC] px-5 py-4" data-testid="note-payment-failed">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div><p className="font-medium text-danger">Payment Failed</p><p className="mt-0.5 text-[14px] text-cocoa-100">We could not verify your payment. Please pay again below or contact us with your Order ID.</p></div>
          </div>
        )}
        {(ps === 'cancelled' || order.orderStatus === 'cancelled') && (
          <div className="rounded-2xl border border-cocoa/10 bg-cream-200 px-5 py-4" data-testid="note-order-cancelled"><p className="font-medium">Order Cancelled</p><p className="mt-0.5 text-[14px] text-cocoa-100">This order has been cancelled. Contact us if you have any questions.</p></div>
        )}
        {paymentInstructions && order.orderStatus !== 'cancelled' && (ps === 'awaiting_payment' || ps === 'failed') && (
          <UpiPaymentPanel order={order} pay={paymentInstructions} onConfirm={confirm} confirming={confirming} />
        )}

        <section className="card p-5 sm:p-7">
          <h2 className="mb-4 text-2xl">Items</h2>
          <ul className="divide-y divide-cocoa/5">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-4 py-3.5">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-beige">{i.thumbUrl && <img src={mediaUrl(i.thumbUrl)} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  {i.productSlug ? <Link to={`/products/${i.productSlug}`} className="font-medium hover:text-gold-dark">{i.productName}</Link> : <p className="font-medium">{i.productName}</p>}
                  <p className="text-[12.5px] text-cocoa-50">{i.sku} · Qty {i.quantity} × {formatINR(i.unitPrice)}</p>
                </div>
                <p className="font-medium">{formatINR(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-cocoa/5 pt-4 text-[14.5px]">
            <div className="flex justify-between"><dt className="text-cocoa-100">Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-cocoa-100">Delivery</dt><dd>{order.deliveryCharge ? formatINR(order.deliveryCharge) : 'Free'}</dd></div>
            {order.taxMode === 'exclusive' && <div className="flex justify-between"><dt className="text-cocoa-100">Tax</dt><dd>{formatINR(order.taxAmount, true)}</dd></div>}
            <div className="flex items-baseline justify-between pt-1"><dt className="font-medium">Total</dt><dd className="font-display text-[24px] font-semibold" data-testid="text-order-total">{formatINR(order.totalAmount, order.totalAmount % 1 !== 0)}</dd></div>
          </dl>
        </section>

        <section className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
          <div><h3 className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cocoa-50">Deliver to</h3><p className="font-medium">{order.customerName}</p><p className="text-[14px] text-cocoa-100">{order.address}, {order.city}, {order.state} – {order.pincode}</p></div>
          <div><h3 className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cocoa-50">Contact</h3><p className="text-[14px]">{order.phone}</p><p className="text-[14px] text-cocoa-100">{order.email}</p><p className="mt-2 text-[13px] text-cocoa-50">Payment method: UPI</p></div>
        </section>
        <p className="text-center text-[13px] text-cocoa-50">Bookmark this page to check your order status anytime.</p>
      </div>
    </div>
  );
}

export function TrackOrderForm({ initialOrder = '', onFound }: { initialOrder?: string; onFound: (orderNumber: string, phone: string) => void }) {
  const [n, setN] = useState(initialOrder);
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!n.trim() || !/^\d{10}$/.test(p.trim())) return setErr('Enter your Order ID and the 10-digit mobile number used for the order.');
    setBusy(true);
    try {
      await api(`/api/orders/${encodeURIComponent(n.trim().toUpperCase())}?phone=${p.trim()}`);
      onFound(n.trim().toUpperCase(), p.trim());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <Field label="Order ID"><Input value={n} onChange={(e) => setN(e.target.value)} placeholder="MPR-20260924-0001" data-testid="input-track-order" /></Field>
      <Field label="Mobile number"><Input value={p} onChange={(e) => setP(e.target.value)} inputMode="numeric" maxLength={10} placeholder="10-digit mobile" data-testid="input-track-phone" /></Field>
      {err && <ErrorNote message={err} />}
      <button className="btn-primary w-full py-3" disabled={busy} data-testid="button-track">{busy ? <Spinner /> : <Search className="h-4 w-4" />} Track order</button>
    </form>
  );
}

export function TrackOrder({ initialOrder = '' }: { initialOrder?: string }) {
  useSeo('Track your order');
  const nav = useNavigate();
  const recent = recentOrders();
  return (
    <div className="container-lux max-w-lg pt-12 sm:pt-16">
      <p className="eyebrow">Orders</p>
      <h1 className="mb-7 mt-2 text-[36px]">Track your order</h1>
      <TrackOrderForm initialOrder={initialOrder} onFound={(n, p) => nav(`/order/${n}?phone=${p}`)} />
      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cocoa-50">Recent orders on this device</h2>
          <ul className="space-y-2">{recent.map((o) => <li key={o.n}><Link to={`/order/${o.n}?t=${o.t}`} className="text-[15px] text-gold-dark underline underline-offset-4">{o.n}</Link></li>)}</ul>
        </div>
      )}
    </div>
  );
}
