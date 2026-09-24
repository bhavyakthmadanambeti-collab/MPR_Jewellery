import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Gem, Scale, Play } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useSeo } from '@/hooks/useSeo';
import type { Collection, CollectionMedia, HomeSection, Product, RatesResponse } from '@/types';
import { mediaUrl } from '@/services/api';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { ErrorNote, LazyVideo, SectionHeading } from '@/components/ui';
import { asset } from '@/utils/asset';
import { cls } from '@/utils/format';

interface HomeData {
  hero: Collection | null;
  home: { eyebrow: string; subtitle: string; sections: HomeSection[] };
  collections: Collection[];
  featured: Product[];
  rates: RatesResponse;
}

export default function Home() {
  useSeo('MPR JEWELLERY — Gold, Silver & Diamond Jewellery', 'Shop hallmarked gold, sterling silver and diamond jewellery from MPR JEWELLERY. Daily gold and silver rates, secure UPI checkout.');
  const { data, loading, error, reload } = useApi<HomeData>('/api/home');

  if (error) return <div className="container-lux py-16"><ErrorNote message={error} onRetry={() => reload()} /></div>;
  if (loading || !data) return <HomeSkeleton />;

  const render: Record<string, () => JSX.Element | null> = {
    hero: () => <Hero data={data} />,
    categories: () => <Categories />,
    showcase: () => (data.hero && data.hero.media.length > 1 ? <Showcase c={data.hero} /> : null),
    featured: () => <Featured products={data.featured} />,
    collections: () => (data.collections.length ? <CollectionBands items={data.collections} /> : null),
    craft: () => <Craft />,
  };
  return (
    <div>
      {data.home.sections.filter((s) => s.enabled).map((s) => (
        <div key={s.key}>{render[s.key]?.()}</div>
      ))}
    </div>
  );
}

function HeroMedia({ m, priority }: { m: CollectionMedia; priority?: boolean }) {
  if (m.type === 'video') return <LazyVideo src={mediaUrl(m.url)} poster={mediaUrl(m.posterUrl)} autoPlay controls={false} className="h-full w-full object-cover" label={m.alt} />;
  return <img src={mediaUrl(m.url)} alt={m.alt} className="h-full w-full object-cover" {...({ fetchpriority: priority ? 'high' : 'auto' } as any)} decoding="async" />;
}

function Hero({ data }: { data: HomeData }) {
  const c = data.hero;
  const lead = c?.media[0];
  return (
    <section className="relative isolate overflow-hidden bg-cocoa-500" aria-label={c?.title || 'Featured'}>
      <div className="absolute inset-0 -z-10">
        {lead ? <HeroMedia m={lead} priority /> : <img src={asset('og-image.jpg')} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink/50 to-transparent" />
      </div>
      <div className="container-lux flex min-h-[520px] items-center py-20 sm:min-h-[600px] lg:min-h-[640px]">
        <div className="max-w-lg animate-fadeUp">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-gold-light">{data.home.eyebrow}</p>
          <h1 className="mt-4 font-display text-[44px] font-semibold leading-[1.02] text-cream sm:text-[60px]" data-testid="text-hero-title">{c?.title || 'Fine Jewellery'}</h1>
          <div className="mt-5 h-px w-20 bg-gold-gradient" />
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-cream/75">{c?.description || data.home.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/jewellery" className="btn-gold px-6 py-3" data-testid="link-shop-hero">Shop Jewellery <ArrowRight className="h-4 w-4" /></Link>
            {c && <Link to={`/collections/${c.slug}`} className="btn border border-cream/30 px-6 py-3 text-cream hover:border-gold-light hover:bg-cream/10">View Collection</Link>}
          </div>
        </div>
      </div>
    </section>
  );
}

const CATS = [
  { key: 'gold', label: 'Gold', to: '/gold' },
  { key: 'silver', label: 'Silver', to: '/silver' },
  { key: 'diamond', label: 'Diamond', to: '/jewellery?category=diamond' },
  { key: 'rings', label: 'Rings', to: '/jewellery?category=rings' },
  { key: 'necklaces', label: 'Necklaces', to: '/jewellery?category=necklaces' },
  { key: 'earrings', label: 'Earrings', to: '/jewellery?category=earrings' },
  { key: 'bangles', label: 'Bangles', to: '/jewellery?category=bangles' },
  { key: 'chains', label: 'Chains', to: '/jewellery?category=chains' },
];

function Categories() {
  return (
    <section className="container-lux pt-16 sm:pt-20" aria-labelledby="cat-h">
      <SectionHeading eyebrow="Shop by" title="Categories" />
      <h2 id="cat-h" className="sr-only">Shop by category</h2>
      <div className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-8">
        {CATS.map((c) => (
          <Link key={c.key} to={c.to} className="group w-[128px] shrink-0 snap-start sm:w-auto" data-testid={`link-category-${c.key}`}>
            <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-beige ring-1 ring-cocoa/5">
              <img src={asset(`cat/${c.key}.webp`)} alt={`${c.label} jewellery`} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            </div>
            <p className="mt-2.5 text-center font-display text-[18px] font-semibold text-cocoa group-hover:text-gold-dark">{c.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Promotional media from the hero collection. Display only — no prices, no Buy Now. */
function Showcase({ c }: { c: Collection }) {
  const items = c.media.slice(1, 7);
  return (
    <section className="container-lux pt-20" aria-label={`${c.title} showcase`}>
      <SectionHeading eyebrow="Showcase" title={c.title} action={<Link to={`/collections/${c.slug}`} className="hidden items-center gap-1.5 text-sm text-cocoa-100 hover:text-cocoa sm:inline-flex">View all <ArrowRight className="h-4 w-4" /></Link>} />
      <div className={cls('grid gap-3 sm:gap-4', items.length >= 2 ? 'sm:grid-cols-2' : '', items.length >= 3 ? 'lg:grid-cols-3' : '')}>
        {items.map((m, i) => (
          <div key={m.id} className={cls('relative overflow-hidden rounded-2xl bg-beige ring-1 ring-cocoa/5', i === 0 && items.length >= 3 ? 'aspect-[4/5] lg:row-span-2 lg:aspect-auto' : 'aspect-[4/3]')}>
            {m.type === 'video' ? (
              <>
                <LazyVideo src={mediaUrl(m.url)} poster={mediaUrl(m.posterUrl)} autoPlay controls={false} className="absolute inset-0 h-full w-full object-cover" label={m.alt} />
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ink/55 px-2.5 py-1 text-[11px] text-cream backdrop-blur"><Play className="h-3 w-3" /> Film</span>
              </>
            ) : (
              <img src={mediaUrl(m.url)} alt={m.alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Featured({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className="container-lux pt-20" aria-label="Featured jewellery">
      <SectionHeading eyebrow="Curated for you" title="Featured Jewellery" action={<Link to="/jewellery" className="inline-flex items-center gap-1.5 text-sm text-cocoa-100 hover:text-cocoa">Shop all <ArrowRight className="h-4 w-4" /></Link>} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
        {products.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}

function CollectionBands({ items }: { items: Collection[] }) {
  return (
    <section className="pt-24" aria-label="Collections">
      <div className="container-lux"><SectionHeading eyebrow="Discover" title="Our Collections" action={<Link to="/collections" className="inline-flex items-center gap-1.5 text-sm text-cocoa-100 hover:text-cocoa">All collections <ArrowRight className="h-4 w-4" /></Link>} /></div>
      <div className="container-lux grid gap-4 md:grid-cols-2">
        {items.slice(0, 4).map((c) => {
          const cover = c.media[0];
          return (
            <Link key={c.id} to={`/collections/${c.slug}`} className="group relative block aspect-[5/4] overflow-hidden rounded-2xl bg-cocoa ring-1 ring-cocoa/5 sm:aspect-[16/11]" data-testid={`link-collection-${c.id}`}>
              {cover && (cover.type === 'image'
                ? <img src={mediaUrl(cover.url)} alt={cover.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-[1.2s] group-hover:scale-[1.03]" />
                : <LazyVideo src={mediaUrl(cover.url)} poster={mediaUrl(cover.posterUrl)} autoPlay controls={false} className="absolute inset-0 h-full w-full object-cover" />)}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-gold-light">{c.mediaCount} {c.mediaCount === 1 ? 'piece' : 'pieces'} to explore</p>
                <h3 className="mt-1.5 font-display text-[30px] text-cream">{c.title}</h3>
                {c.description && <p className="mt-1 line-clamp-1 text-[14px] text-cream/70">{c.description}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Craft() {
  const points = [
    { icon: ShieldCheck, t: 'BIS Hallmarked gold', d: 'Every gold piece carries a hallmark of purity.' },
    { icon: Gem, t: 'Certified diamonds', d: 'Diamonds sourced with certification on request.' },
    { icon: Scale, t: 'Transparent pricing', d: 'Weight, purity and price shown for every piece.' },
  ];
  return (
    <section className="container-lux pt-24" aria-label="Our craft">
      <div className="grid overflow-hidden rounded-2xl bg-cocoa text-cream shadow-lift md:grid-cols-2">
        <img src={asset('about-craft.webp')} alt="Goldsmith engraving a gold bangle by hand" loading="lazy" className="h-72 w-full object-cover md:h-full" />
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-gold-light">Craftsmanship</p>
          <h2 className="mt-3 font-display text-[34px] leading-tight text-cream">Made by hand, made to last</h2>
          <ul className="mt-8 space-y-5">
            {points.map((p) => (
              <li key={p.t} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream/5 ring-1 ring-gold/30"><p.icon className="h-[18px] w-[18px] text-gold-light" /></span>
                <div><p className="font-medium text-cream">{p.t}</p><p className="mt-0.5 text-[14px] text-cream/60">{p.d}</p></div>
              </li>
            ))}
          </ul>
          <Link to="/about" className="mt-9 inline-flex items-center gap-2 self-start text-[14px] text-gold-light hover:text-cream">Our story <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div>
      <div className="skeleton h-[560px] rounded-none" />
      <div className="container-lux grid grid-cols-2 gap-6 pt-16 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
    </div>
  );
}
