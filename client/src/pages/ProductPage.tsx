import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag, Zap, Minus, Plus, ShieldCheck, Truck, BadgeCheck, Play, ChevronRight } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useSeo } from '@/hooks/useSeo';
import type { Product } from '@/types';
import { mediaUrl } from '@/services/api';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useSite } from '@/context/SiteContext';
import { EmptyState, ErrorNote, LazyVideo, Skeleton } from '@/components/ui';
import { AVAILABILITY_LABELS, CATEGORY_LABELS, METAL_LABELS, cls, formatINR } from '@/utils/format';

type Slide = { kind: 'image'; url: string; thumb: string; alt: string } | { kind: 'video'; url: string; poster: string | null };

export default function ProductPage() {
  const { slug } = useParams();
  const { data: p, loading, error } = useApi<Product>(`/api/products/${slug}`);
  useSeo(p ? p.name : 'Jewellery', p?.description.slice(0, 155), p?.images[0] ? mediaUrl(p.images[0].url) : undefined);

  if (loading) return <ProductSkeleton />;
  if (error || !p) return <div className="container-lux py-20"><EmptyState title="Product not found" text={error || 'This product may have been removed.'} action={<Link to="/jewellery" className="btn-primary">Browse jewellery</Link>} /></div>;
  return <ProductView p={p} />;
}

function ProductView({ p }: { p: Product }) {
  const nav = useNavigate();
  const { add } = useCart();
  const { toast } = useToast();
  const { settings } = useSite();
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const slides: Slide[] = [
    ...p.images.map((i) => ({ kind: 'image' as const, url: mediaUrl(i.url), thumb: mediaUrl(i.thumbUrl), alt: i.alt || p.name })),
    ...p.videos.map((v) => ({ kind: 'video' as const, url: mediaUrl(v.url), poster: v.posterUrl ? mediaUrl(v.posterUrl) : null })),
  ];
  const available = p.availability !== 'out_of_stock';
  const maxQty = p.availability === 'in_stock' ? Math.min(p.stock, 20) : 20;

  const go = (i: number) => {
    setActive(i);
    const el = track.current;
    if (el) el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' });
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const addToCart = () => {
    if (!available) return toast('Product is currently unavailable.', 'error');
    add({ productId: p.id, quantity: qty, name: p.name, slug: p.slug });
    toast(`${p.name} added to your cart.`);
  };
  const buyNow = () => {
    if (!available) return toast('Product is currently unavailable.', 'error');
    nav(`/checkout?buy=${p.id}&qty=${qty}`);
  };

  const specs: [string, string][] = [
    ['Metal', METAL_LABELS[p.metalType] || p.metalType],
    ['Purity', p.purity || '—'],
    ['Weight', `${p.weightGrams} g`],
    ['Category', CATEGORY_LABELS[p.category]],
    ['Product ID', p.sku],
  ];

  return (
    <div className="container-lux pb-28 pt-6 md:pb-0">
      <nav className="mb-6 flex items-center gap-1.5 text-[13px] text-cocoa-50" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-cocoa">Home</Link><ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/jewellery?category=${p.category}`} className="hover:text-cocoa">{CATEGORY_LABELS[p.category]}</Link><ChevronRight className="h-3.5 w-3.5" />
        <span className="line-clamp-1 text-cocoa-200">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex gap-3">
            {slides.length > 1 && (
              <div className="hidden w-[76px] shrink-0 flex-col gap-2.5 sm:flex">
                {slides.map((s, i) => (
                  <button key={i} onClick={() => go(i)} className={cls('relative aspect-square overflow-hidden rounded-xl bg-beige ring-1 transition', i === active ? 'ring-2 ring-gold' : 'ring-cocoa/10 opacity-80 hover:opacity-100')} aria-label={`Show ${s.kind} ${i + 1}`} data-testid={`button-thumb-${i}`}>
                    {s.kind === 'image' ? <img src={s.thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : (
                      <>{s.poster ? <img src={s.poster} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-cocoa" />}<span className="absolute inset-0 grid place-items-center bg-ink/30"><Play className="h-5 w-5 fill-cream text-cream" /></span></>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="relative min-w-0 flex-1">
              <div ref={track} className="scrollbar-none flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto rounded-2xl bg-beige shadow-soft ring-1 ring-cocoa/5" data-testid="gallery-main">
                {slides.length === 0 && <div className="grid w-full place-items-center text-sm text-cocoa-50">No image yet</div>}
                {slides.map((s, i) => (
                  <div key={i} className="relative h-full w-full shrink-0 snap-center">
                    {s.kind === 'image'
                      ? <img src={s.url} alt={s.alt} className="h-full w-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                      : <LazyVideo src={s.url} poster={s.poster} className="h-full w-full bg-ink object-contain" label={`${p.name} video`} />}
                  </div>
                ))}
              </div>
              {slides.length > 1 && (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 sm:hidden">
                  {slides.map((_, i) => <span key={i} className={cls('h-1.5 rounded-full transition-all', i === active ? 'w-5 bg-pearl' : 'w-1.5 bg-pearl/60')} />)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div>
          <p className="eyebrow">{p.purity} {METAL_LABELS[p.metalType]}</p>
          <h1 className="mt-2 text-[34px] leading-[1.1] sm:text-[40px]" data-testid="text-product-name">{p.name}</h1>
          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <p className="font-display text-[32px] font-semibold text-cocoa" data-testid="text-product-price">{formatINR(p.price)}</p>
            {settings?.commerce.tax.mode === 'inclusive' && <span className="text-[13px] text-cocoa-50">Inclusive of {settings.commerce.tax.label}</span>}
          </div>
          <p className={cls('mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-medium', available ? 'text-success' : 'text-danger')} data-testid="text-availability">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {p.availability === 'in_stock' ? (p.stock <= 3 ? `Only ${p.stock} left` : 'In stock') : AVAILABILITY_LABELS[p.availability]}
          </p>

          <div className="hairline my-7" />
          <p className="text-[15.5px] leading-relaxed text-cocoa-100">{p.description}</p>

          <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-cocoa/[0.06] ring-1 ring-cocoa/[0.06] sm:grid-cols-3">
            {specs.map(([k, v]) => (
              <div key={k} className="bg-pearl px-4 py-3.5">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-cocoa-50">{k}</dt>
                <dd className="mt-1 text-[15px] font-medium text-cocoa">{v}</dd>
              </div>
            ))}
          </dl>

          {available ? (
            <div className="mt-8 hidden md:block">
              <div className="flex items-center gap-4">
                <span className="text-sm text-cocoa-100">Quantity</span>
                <QtyStepper value={qty} onChange={setQty} max={maxQty} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={addToCart} className="btn-outline py-3.5 text-[14.5px] font-semibold tracking-wide" data-testid="button-add-to-cart"><ShoppingBag className="h-[18px] w-[18px]" /> ADD TO CART</button>
                <button onClick={buyNow} className="btn-primary py-3.5 text-[14.5px] font-semibold tracking-wide" data-testid="button-buy-now"><Zap className="h-[18px] w-[18px]" /> BUY NOW</button>
              </div>
            </div>
          ) : (
            <div className="mt-8"><ErrorNote message="Product is currently unavailable." /></div>
          )}

          <ul className="mt-8 space-y-3 text-[14px] text-cocoa-100">
            <li className="flex items-center gap-3"><ShieldCheck className="h-[18px] w-[18px] text-gold-deep" /> Hallmarked purity, weighed and verified</li>
            <li className="flex items-center gap-3"><BadgeCheck className="h-[18px] w-[18px] text-gold-deep" /> Secure UPI payment, verified by our team</li>
            <li className="flex items-center gap-3"><Truck className="h-[18px] w-[18px] text-gold-deep" /> {settings ? (settings.commerce.delivery.freeAbove ? `Free insured delivery above ${formatINR(settings.commerce.delivery.freeAbove)}` : 'Insured delivery') : 'Insured delivery'}</li>
          </ul>
        </div>
      </div>

      {/* Mobile sticky actions */}
      {available && (
        <div className="safe-bottom fixed inset-x-0 bottom-[58px] z-30 border-t border-cocoa/[0.07] bg-pearl/95 px-4 py-3 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2.5">
            <QtyStepper value={qty} onChange={setQty} max={maxQty} compact />
            <button onClick={addToCart} className="btn-outline flex-1 px-3 py-3 text-[13px] font-semibold" data-testid="button-add-to-cart-mobile">ADD TO CART</button>
            <button onClick={buyNow} className="btn-primary flex-1 px-3 py-3 text-[13px] font-semibold" data-testid="button-buy-now-mobile">BUY NOW</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function QtyStepper({ value, onChange, max = 20, compact }: { value: number; onChange: (n: number) => void; max?: number; compact?: boolean }) {
  return (
    <div className={cls('inline-flex items-center rounded-full border border-cocoa/15 bg-pearl', compact ? 'h-11' : 'h-11')}>
      <button className="grid h-full w-10 place-items-center text-cocoa-100 hover:text-cocoa disabled:opacity-40" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Decrease quantity" data-testid="button-qty-decrease"><Minus className="h-4 w-4" /></button>
      <span className="w-7 text-center text-[15px] font-medium" data-testid="text-qty">{value}</span>
      <button className="grid h-full w-10 place-items-center text-cocoa-100 hover:text-cocoa disabled:opacity-40" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity" data-testid="button-qty-increase"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-lux grid gap-10 pt-12 lg:grid-cols-2">
      <Skeleton className="aspect-[4/5] rounded-2xl" />
      <div className="space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-8 w-40" /><Skeleton className="h-28 w-full" /><Skeleton className="h-12 w-full" /></div>
    </div>
  );
}
