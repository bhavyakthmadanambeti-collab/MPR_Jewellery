import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Eye, ClipboardList, CheckCircle2, XCircle, Ban, BadgeCheck, History } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { api, mediaUrl } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import type { Order } from '@/types';
import { OwnerPageHeader } from '@/layouts/OwnerLayout';
import { EmptyState, ErrorNote, Modal, PageLoader, Select, Skeleton, Spinner, StatusBadge, Textarea } from '@/components/ui';
import { OWNER_PAYMENT_LABELS, ORDER_LABELS, cls, formatDate, formatINR } from '@/utils/format';

interface OwnerOrderDetail {
  order: Order;
  history: { event: string; from: string | null; to: string | null; actorType: string; actor: string | null; note: string | null; at: string }[];
  payments: { id: number; amount: number; status: string; provider: string; customerReference: string | null; customerConfirmedAt: string | null; verifiedAt: string | null; verifiedBy: string | null; ownerNote: string | null }[];
}

const EVENT_LABELS: Record<string, string> = {
  order_created: 'Order created',
  customer_confirmed_payment: 'Customer submitted payment confirmation',
  payment_status_changed: 'Payment status changed',
  order_status_changed: 'Order status changed',
  gateway_webhook: 'Payment gateway update',
};
const label = (s: string | null) => (s ? OWNER_PAYMENT_LABELS[s] || ORDER_LABELS[s] || s : '—');

export default function Orders() {
  const [sp, setSp] = useSearchParams();
  const qs = new URLSearchParams();
  ['q', 'paymentStatus', 'orderStatus'].forEach((k) => sp.get(k) && qs.set(k, sp.get(k)!));
  const { data, setData, loading, error, reload } = useApi<{ items: Order[]; total: number }>(`/api/owner/orders?${qs}`);
  const [q, setQ] = useState(sp.get('q') || '');
  const openId = Number(sp.get('open')) || null;

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };
  const onUpdated = (o: Order) => setData((d) => d && { ...d, items: d.items.map((x) => (x.id === o.id ? { ...x, ...o, itemSummary: x.itemSummary } : x)) });

  return (
    <div>
      <OwnerPageHeader title="Orders" sub="Verify UPI payments against your bank or UPI app before marking an order as paid." />
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
        <form onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }} className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-50" />
          <input className="input pl-10" placeholder="Order ID, name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => set('q', q.trim())} data-testid="input-order-search" />
        </form>
        <Select value={sp.get('paymentStatus') || ''} onChange={(e) => set('paymentStatus', e.target.value)} className="sm:w-52" aria-label="Payment status" data-testid="select-filter-payment">
          <option value="">All payments</option>
          {Object.entries(OWNER_PAYMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select value={sp.get('orderStatus') || ''} onChange={(e) => set('orderStatus', e.target.value)} className="sm:w-44" aria-label="Order status">
          <option value="">All statuses</option>
          {Object.entries(ORDER_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>

      {error && <ErrorNote message={error} onRetry={() => reload()} />}
      {loading && !data ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : data && data.items.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No orders found" text="Orders placed by customers will appear here." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-lux w-full min-w-[980px]">
              <thead className="bg-cream/60"><tr><th>Order ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Payment</th><th>Order Status</th><th>Date</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {data?.items.map((o) => (
                  <tr key={o.id} data-testid={`row-order-${o.id}`}>
                    <td className="font-medium">{o.orderNumber}</td>
                    <td><p>{o.customerName}</p><p className="text-[12px] text-cocoa-50">{o.phone}</p></td>
                    <td className="max-w-[220px]"><p className="line-clamp-2 text-cocoa-100">{o.itemSummary}</p></td>
                    <td className="font-medium">{formatINR(o.totalAmount, o.totalAmount % 1 !== 0)}</td>
                    <td><StatusBadge kind="payment" status={o.paymentStatus} owner /></td>
                    <td><StatusBadge kind="order" status={o.orderStatus} /></td>
                    <td className="whitespace-nowrap text-[13px] text-cocoa-100">{formatDate(o.createdAt)}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button onClick={() => set('open', String(o.id))} className="btn-outline btn-sm" data-testid={`button-view-order-${o.id}`}><Eye className="h-3.5 w-3.5" /> View</button>
                        {o.paymentStatus === 'pending_verification' && <button onClick={() => set('open', String(o.id))} className="btn-gold btn-sm" data-testid={`button-verify-${o.id}`}><BadgeCheck className="h-3.5 w-3.5" /> Verify Payment</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <OrderDetailModal id={openId} onClose={() => set('open', '')} onUpdated={onUpdated} />
    </div>
  );
}

function OrderDetailModal({ id, onClose, onUpdated }: { id: number | null; onClose: () => void; onUpdated: (o: Order) => void }) {
  const { toast } = useToast();
  const [d, setD] = useState<OwnerOrderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAct, setConfirmAct] = useState<{ status: string; title: string } | null>(null);

  useEffect(() => {
    setD(null);
    setErr(null);
    setNote('');
    if (!id) return;
    api<OwnerOrderDetail>(`/api/owner/orders/${id}`).then(setD).catch((e) => setErr(e.message));
  }, [id]);

  const setPayment = async (status: string) => {
    setBusy(status);
    try {
      const r = await api<OwnerOrderDetail>(`/api/owner/orders/${id}/payment`, { method: 'PUT', body: { status, note: note.trim() || undefined } });
      setD(r);
      onUpdated(r.order);
      setNote('');
      toast(`Payment marked as ${OWNER_PAYMENT_LABELS[status] || status}.`);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
      setConfirmAct(null);
    }
  };
  const setStatus = async (status: string) => {
    setBusy('status');
    try {
      const r = await api<OwnerOrderDetail>(`/api/owner/orders/${id}/status`, { method: 'PUT', body: { status, note: note.trim() || undefined } });
      setD(r);
      onUpdated(r.order);
      setNote('');
      toast(`Order status updated to ${ORDER_LABELS[status]}.`);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const o = d?.order;
  const pay = d?.payments[d.payments.length - 1];
  const closed = o && (o.orderStatus === 'cancelled' || o.orderStatus === 'delivered');

  return (
    <Modal open={!!id} onClose={onClose} title={o ? `Order ${o.orderNumber}` : 'Order'} wide>
      {err ? <ErrorNote message={err} /> : !d || !o ? <PageLoader /> : (
        <div className="space-y-6" data-testid="order-detail">
          <div className="flex flex-wrap gap-2.5 text-sm">
            <span className="text-cocoa-50">Payment</span><StatusBadge kind="payment" status={o.paymentStatus} owner />
            <span className="ml-3 text-cocoa-50">Order</span><StatusBadge kind="order" status={o.orderStatus} />
            <span className="ml-auto text-cocoa-50">{formatDate(o.createdAt)}</span>
          </div>

          <section className="rounded-2xl border border-gold/30 bg-cream p-4 sm:p-5">
            <h3 className="font-display text-[20px] font-semibold">Payment verification</h3>
            <div className="mt-2 grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-2">
              <p><span className="text-cocoa-50">Amount due: </span><span className="font-semibold">{formatINR(o.totalAmount, o.totalAmount % 1 !== 0)}</span></p>
              <p><span className="text-cocoa-50">Method: </span>UPI (manual verification)</p>
              <p><span className="text-cocoa-50">Customer confirmed: </span>{pay?.customerConfirmedAt ? formatDate(pay.customerConfirmedAt) : 'Not yet'}</p>
              <p><span className="text-cocoa-50">Customer UTR / reference: </span><span className="font-medium">{pay?.customerReference || '—'}</span></p>
              {pay?.verifiedAt && <p className="sm:col-span-2"><span className="text-cocoa-50">Last verified: </span>{formatDate(pay.verifiedAt)}{pay.verifiedBy ? ` by ${pay.verifiedBy}` : ''}</p>}
            </div>
            <p className="mt-3 text-[12.5px] text-cocoa-50">Check your bank/UPI app for a credit of this exact amount (and the UTR if provided) before marking as paid.</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the audit record (e.g. UTR matched in bank statement)" className="mt-3 min-h-[64px] bg-pearl" data-testid="input-owner-note" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={!!busy || o.paymentStatus === 'paid' || o.orderStatus === 'cancelled'} onClick={() => setConfirmAct({ status: 'paid', title: 'Mark payment as paid?' })} className="btn-primary btn-sm" data-testid="button-mark-paid"><CheckCircle2 className="h-4 w-4" /> Mark Paid</button>
              <button disabled={!!busy || o.paymentStatus === 'pending_verification' || !!closed} onClick={() => setPayment('pending_verification')} className="btn-outline btn-sm" data-testid="button-mark-pending">{busy === 'pending_verification' && <Spinner />} Pending Verification</button>
              <button disabled={!!busy || o.paymentStatus === 'failed' || !!closed} onClick={() => setConfirmAct({ status: 'failed', title: 'Mark payment as failed?' })} className="btn-outline btn-sm text-danger" data-testid="button-mark-failed"><XCircle className="h-4 w-4" /> Mark Failed</button>
              <button disabled={!!busy || !!closed} onClick={() => setConfirmAct({ status: 'cancelled', title: 'Cancel this order?' })} className="btn-outline btn-sm" data-testid="button-cancel-order"><Ban className="h-4 w-4" /> Cancel</button>
            </div>
          </section>

          <section>
            <h3 className="mb-2 font-display text-[20px] font-semibold">Update order status</h3>
            <div className="flex flex-wrap items-center gap-2">
              {(['placed', 'processing', 'ready', 'dispatched', 'delivered'] as const).map((s) => (
                <button key={s} disabled={busy === 'status' || o.orderStatus === s || o.orderStatus === 'cancelled' || (s !== 'placed' && o.paymentStatus !== 'paid')} onClick={() => setStatus(s)}
                  className={cls('chip disabled:cursor-not-allowed disabled:opacity-40', o.orderStatus === s && 'chip-active !opacity-100')} data-testid={`button-status-${s}`}>{ORDER_LABELS[s]}</button>
              ))}
              {busy === 'status' && <Spinner />}
            </div>
            {o.paymentStatus !== 'paid' && o.orderStatus !== 'cancelled' && <p className="mt-2 text-[12.5px] text-cocoa-50">Fulfilment steps unlock after the payment is marked as paid.</p>}
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cocoa-50">Customer</h3>
              <p className="font-medium">{o.customerName}</p>
              <p className="text-[14px]"><a className="hover:text-gold-dark" href={`tel:${o.phone}`}>{o.phone}</a> · <a className="break-all hover:text-gold-dark" href={`mailto:${o.email}`}>{o.email}</a></p>
              <p className="mt-1 text-[14px] text-cocoa-100">{o.address}, {o.city}, {o.state} – {o.pincode}</p>
            </div>
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cocoa-50">Amounts</h3>
              <dl className="space-y-1 text-[14px]">
                <div className="flex justify-between"><dt className="text-cocoa-100">Subtotal</dt><dd>{formatINR(o.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-cocoa-100">Delivery</dt><dd>{o.deliveryCharge ? formatINR(o.deliveryCharge) : 'Free'}</dd></div>
                <div className="flex justify-between"><dt className="text-cocoa-100">Tax ({o.taxMode})</dt><dd>{formatINR(o.taxAmount, true)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatINR(o.totalAmount, o.totalAmount % 1 !== 0)}</dd></div>
              </dl>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cocoa-50">Items</h3>
            <ul className="divide-y divide-cocoa/5 rounded-xl ring-1 ring-cocoa/[0.06]">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-beige">{i.thumbUrl && <img src={mediaUrl(i.thumbUrl)} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">{i.productName}</p><p className="text-[12px] text-cocoa-50">{i.sku} · {i.purity} · {i.weightGrams} g · Qty {i.quantity}</p></div>
                  <p className="text-[14px] font-medium">{formatINR(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cocoa-50"><History className="h-3.5 w-3.5" /> Payment & status audit record</h3>
            <ol className="space-y-2.5 border-l border-gold/30 pl-4" data-testid="audit-log">
              {d.history.map((h, i) => (
                <li key={i} className="relative text-[13.5px]">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-gold" />
                  <p><span className="font-medium">{EVENT_LABELS[h.event] || h.event}</span>{h.to && <> · {h.from ? `${label(h.from)} → ` : ''}{label(h.to)}</>}</p>
                  <p className="text-[12px] text-cocoa-50">{formatDate(h.at)} · {h.actorType === 'owner' ? h.actor || 'Owner' : h.actorType === 'customer' ? 'Customer' : h.actorType === 'gateway' ? 'Gateway' : 'System'}{h.note ? ` · “${h.note}”` : ''}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      <Modal open={!!confirmAct} onClose={() => setConfirmAct(null)} title={confirmAct?.title || ''}
        footer={<>
          <button className="btn-outline btn-sm" onClick={() => setConfirmAct(null)} disabled={!!busy}>Back</button>
          <button className={cls('btn-sm', confirmAct?.status === 'paid' ? 'btn-primary' : 'btn-danger')} onClick={() => confirmAct && setPayment(confirmAct.status)} disabled={!!busy} data-testid="button-confirm-action">{busy && <Spinner />} Confirm</button>
        </>}>
        <p className="text-[14.5px] text-cocoa-100">
          {confirmAct?.status === 'paid' ? `Confirm that ${o ? formatINR(o.totalAmount, o.totalAmount % 1 !== 0) : ''} has been received in your account. The customer will see “Payment Verified”.` :
            confirmAct?.status === 'failed' ? 'The customer will see “Payment Failed” and can try paying again. Reserved stock is released.' :
              'The order will be cancelled and reserved stock released. The customer will see “Order Cancelled”.'}
        </p>
      </Modal>
    </Modal>
  );
}
