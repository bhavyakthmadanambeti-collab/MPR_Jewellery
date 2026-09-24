import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useSeo } from '@/hooks/useSeo';
import { api, mediaUrl } from '@/services/api';
import type { Quote } from '@/types';
import { EmptyState, ErrorNote, Skeleton, Spinner } from '@/components/ui';
import { QtyStepper } from './ProductPage';
import { formatINR } from '@/utils/format';

export function useQuote(lines: { productId: number; quantity: number }[]) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(lines.map((l) => [l.productId, l.quantity]));
  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      return;
    }
    let off = false;
    setLoading(true);
    api<Quote>('/api/cart/quote', { body: { items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) } })
      .then((q) => !off && (setQuote(q), setError(null)))
      .catch((e) => !off && (setError(e.message), setQuote(null)))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { quote, error, loading };
}

export function Summary({ q, loading }: { q: Quote | null; loading?: boolean }) {
  if (!q) return <div className="space-y-3"><Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-6" /></div>;
  return (
    <dl className="space-y-2.5 text-[14.5px]" data-testid="order-summary">
      <div className="flex justify-between"><dt className="text-cocoa-100">Subtotal</dt><dd data-testid="text-subtotal">{formatINR(q.subtotal)}</dd></div>
      <div className="flex justify-between"><dt className="text-cocoa-100">Delivery</dt><dd data-testid="text-delivery">{q.delivery === 0 ? 'Free' : formatINR(q.delivery)}</dd></div>
      {q.tax.mode === 'exclusive' && <div className="flex justify-between"><dt className="text-cocoa-100">{q.tax.label} ({q.tax.ratePercent}%)</dt><dd>{formatINR(q.tax.amount, true)}</dd></div>}
      <div className="hairline !my-4" />
      <div className="flex items-baseline justify-between"><dt className="font-medium">Total</dt><dd className="flex items-center gap-2 font-display text-[26px] font-semibold" data-testid="text-total">{loading && <Spinner className="h-4 w-4 text-gold" />}{formatINR(q.total, q.total % 1 !== 0)}</dd></div>
      {q.tax.mode === 'inclusive' && <p className="text-right text-[12px] text-cocoa-50">Inclusive of {q.tax.label} ({formatINR(q.tax.amount, true)})</p>}
      {q.delivery > 0 && q.freeDeliveryAbove > 0 && <p className="text-[12.5px] text-cocoa-50">Free delivery on orders above {formatINR(q.freeDeliveryAbove)}.</p>}
    </dl>
  );
}

export default function Cart() {
  useSeo('Your Cart');
  const { lines, setQty, remove } = useCart();
  const { quote, error, loading } = useQuote(lines);
  const nav = useNavigate();

  if (!lines.length) {
    return <div className="container-lux py-16"><EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="Your cart is empty" text="Discover our gold, silver and diamond jewellery." action={<Link to="/jewellery" className="btn-primary">Shop jewellery</Link>} /></div>;
  }
  return (
    <div className="container-lux pt-10 sm:pt-14">
      <h1 className="text-[36px] sm:text-[40px]">Your Cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="card divide-y divide-cocoa/5">
          {error && <div className="p-4"><ErrorNote message={error} /></div>}
          {lines.map((l) => {
            const it = quote?.items.find((i) => i.productId === l.productId);
            return (
              <div key={l.productId} className="flex gap-4 p-4 sm:p-5" data-testid={`row-cart-${l.productId}`}>
                <Link to={`/products/${it?.slug || l.slug}`} className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-beige sm:h-28 sm:w-24">
                  {it?.thumbUrl && <img src={mediaUrl(it.thumbUrl)} alt={it.name} className="h-full w-full object-cover" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/products/${it?.slug || l.slug}`} className="line-clamp-2 font-display text-[19px] font-semibold leading-snug hover:text-gold-dark">{it?.name || l.name || 'Product'}</Link>
                      {it && <p className="mt-0.5 text-[12.5px] text-cocoa-50">{it.purity} · {it.weightGrams} g · {it.sku}</p>}
                    </div>
                    <button onClick={() => remove(l.productId)} className="rounded-full p-2 text-cocoa-50 hover:bg-beige hover:text-danger" aria-label="Remove" data-testid={`button-remove-${l.productId}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                    <QtyStepper value={l.quantity} onChange={(n) => setQty(l.productId, n)} max={it && it.availability === 'in_stock' ? Math.min(it.stock, 20) : 20} />
                    <div className="text-right">
                      {it ? <><p className="text-[12px] text-cocoa-50">{formatINR(it.unitPrice)} each</p><p className="font-medium" data-testid={`text-line-${l.productId}`}>{formatINR(it.lineTotal)}</p></> : <Skeleton className="h-5 w-20" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="mb-5 text-2xl">Order Summary</h2>
          <Summary q={quote} loading={loading} />
          <button disabled={!quote || !!error} onClick={() => nav('/checkout')} className="btn-primary mt-6 w-full py-3.5 font-semibold tracking-wide" data-testid="button-checkout">Proceed to checkout <ArrowRight className="h-4 w-4" /></button>
          <p className="mt-3 text-center text-[12px] text-cocoa-50">Final amount is confirmed by our server at checkout.</p>
        </aside>
      </div>
    </div>
  );
}
