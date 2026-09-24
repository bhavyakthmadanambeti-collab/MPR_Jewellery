import { Link } from 'react-router-dom';
import { Package, Coins, ClipboardList, CheckCircle2, Clock, MessageSquare, Images, Gem, ArrowRight, BadgeCheck } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import type { Order, RatesResponse } from '@/types';
import { OwnerPageHeader } from '@/layouts/OwnerLayout';
import { ErrorNote, Skeleton, StatusBadge } from '@/components/ui';
import { formatINR, timeAgo } from '@/utils/format';

interface Dash {
  counts: Record<string, number>;
  recentOrders: Order[];
  recentConfirmations: { id: number; orderNumber: string; customerName: string; amount: number; confirmedAt: string; reference: string | null; paymentStatus: string }[];
  recentMessages: { id: number; name: string; email: string; message: string; isRead: boolean; createdAt: string }[];
  rates: RatesResponse;
}

export default function Dashboard() {
  const { data, loading, error, reload } = useApi<Dash>('/api/owner/dashboard');
  if (error) return <ErrorNote message={error} onRetry={() => reload()} />;
  const c = data?.counts;
  const rate = (k: string) => data?.rates.rates.find((r) => r.key === k)?.value ?? null;
  const cards = [
    { label: 'Total Products', v: c?.total_products, icon: Package, to: '/owner/products' },
    { label: 'Gold Products', v: c?.gold_products, icon: Gem, to: '/owner/products?metal=gold' },
    { label: 'Silver Products', v: c?.silver_products, icon: Gem, to: '/owner/products?metal=silver' },
    { label: 'Total Orders', v: c?.total_orders, icon: ClipboardList, to: '/owner/orders' },
    { label: 'Paid Orders', v: c?.paid_orders, icon: CheckCircle2, to: '/owner/orders?paymentStatus=paid' },
    { label: 'Pending Orders', v: c?.pending_orders, icon: Clock, to: '/owner/orders?paymentStatus=pending_verification', note: c?.pending_verification ? `${c.pending_verification} awaiting verification` : undefined },
    { label: 'Customer Messages', v: c?.messages, icon: MessageSquare, to: '/owner/messages', note: c?.unread_messages ? `${c.unread_messages} unread` : undefined },
    { label: 'Home Collections', v: c?.collections, icon: Images, to: '/owner/collections' },
    { label: 'Gold Rate (22K)', v: rate('gold_22k') !== null ? formatINR(rate('gold_22k')) : '—', icon: Coins, to: '/owner/rates', note: 'per gram' },
    { label: 'Silver Rate', v: rate('silver') !== null ? formatINR(rate('silver')) : '—', icon: Coins, to: '/owner/rates', note: 'per gram' },
  ];
  return (
    <div>
      <OwnerPageHeader title="Dashboard" sub="Overview of your store today." action={<Link to="/owner/products/add" className="btn-primary btn-sm">Add product</Link>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((k) => (
          <Link key={k.label} to={k.to} className="card group p-4 transition hover:shadow-lift sm:p-5" data-testid={`card-stat-${k.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-cocoa-50">{k.label}</p>
              <k.icon className="h-4 w-4 text-gold-deep" strokeWidth={1.7} />
            </div>
            {loading ? <Skeleton className="mt-3 h-7 w-16" /> : <p className="mt-2 font-display text-[28px] font-semibold leading-none text-cocoa">{k.v ?? 0}</p>}
            {k.note && <p className="mt-1.5 text-[11.5px] text-gold-dark">{k.note}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-cocoa/5 px-5 py-4"><h2 className="text-xl">Recent Orders</h2><Link to="/owner/orders" className="inline-flex items-center gap-1 text-[13px] text-cocoa-100 hover:text-cocoa">All orders <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {loading ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div> : data!.recentOrders.length === 0 ? <p className="p-6 text-sm text-cocoa-50">No orders yet.</p> : (
            <ul className="divide-y divide-cocoa/5">
              {data!.recentOrders.map((o) => (
                <li key={o.id}><Link to={`/owner/orders?open=${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-cream/60">
                  <div className="min-w-0"><p className="text-[14px] font-medium">{o.orderNumber} · {o.customerName}</p><p className="line-clamp-1 text-[12.5px] text-cocoa-50">{o.itemSummary} · {timeAgo(o.createdAt)}</p></div>
                  <div className="flex items-center gap-2.5"><StatusBadge kind="payment" status={o.paymentStatus} owner /><span className="text-[14px] font-medium">{formatINR(o.totalAmount)}</span></div>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="border-b border-cocoa/5 px-5 py-4"><h2 className="text-xl">Recent Payment Confirmations</h2></div>
            {loading ? <div className="p-5"><Skeleton className="h-10" /></div> : data!.recentConfirmations.length === 0 ? <p className="p-5 text-sm text-cocoa-50">No customer payment confirmations yet.</p> : (
              <ul className="divide-y divide-cocoa/5">
                {data!.recentConfirmations.map((p) => (
                  <li key={p.id}><Link to={`/owner/orders?open=${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-cream/60">
                    <div className="min-w-0"><p className="flex items-center gap-1.5 text-[14px] font-medium"><BadgeCheck className="h-4 w-4 text-gold-deep" />{p.orderNumber}</p><p className="text-[12px] text-cocoa-50">{p.customerName} · {timeAgo(p.confirmedAt)}{p.reference ? ` · UTR ${p.reference}` : ''}</p></div>
                    <div className="text-right"><p className="text-[14px] font-medium">{formatINR(p.amount)}</p><StatusBadge kind="payment" status={p.paymentStatus} owner /></div>
                  </Link></li>
                ))}
              </ul>
            )}
          </section>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-cocoa/5 px-5 py-4"><h2 className="text-xl">Recent Customer Messages</h2><Link to="/owner/messages" className="text-[13px] text-cocoa-100 hover:text-cocoa">View all</Link></div>
            {loading ? <div className="p-5"><Skeleton className="h-10" /></div> : data!.recentMessages.length === 0 ? <p className="p-5 text-sm text-cocoa-50">No messages yet.</p> : (
              <ul className="divide-y divide-cocoa/5">
                {data!.recentMessages.map((m) => (
                  <li key={m.id} className="px-5 py-3"><p className="flex items-center gap-2 text-[14px] font-medium">{!m.isRead && <span className="h-2 w-2 rounded-full bg-gold" />}{m.name} <span className="font-normal text-cocoa-50">· {timeAgo(m.createdAt)}</span></p><p className="line-clamp-1 text-[13px] text-cocoa-100">{m.message}</p></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
