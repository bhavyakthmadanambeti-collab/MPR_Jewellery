import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useSeo } from '@/hooks/useSeo';
import type { Product } from '@/types';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { EmptyState, ErrorNote, Select } from '@/components/ui';
import { AVAILABILITY_LABELS, CATEGORY_LABELS, METAL_LABELS, cls, formatINR } from '@/utils/format';

interface ListResponse { items: Product[]; total: number; facets: { purities: string[]; priceMin: number; priceMax: number } }

const PRICE_PRESETS: [string, number | undefined, number | undefined][] = [
  ['Under ₹10,000', undefined, 10000],
  ['₹10,000 – ₹1 lakh', 10000, 100000],
  ['₹1 – 3 lakh', 100000, 300000],
  ['Above ₹3 lakh', 300000, undefined],
];

export default function Shop({ metal }: { metal?: 'gold' | 'silver' }) {
  const [sp, setSp] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const q = sp.get('q') || '';
  const [qInput, setQInput] = useState(q);
  useEffect(() => setQInput(q), [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams(sp);
    if (metal) p.set('metal', metal);
    return p.toString();
  }, [sp, metal]);

  const title = metal ? `${METAL_LABELS[metal]} Jewellery` : q ? `Results for “${q}”` : sp.get('category') ? `${CATEGORY_LABELS[sp.get('category')!]} Jewellery` : 'All Jewellery';
  useSeo(title, metal === 'gold' ? 'Hallmarked 22K and 18K gold rings, necklaces, earrings and bangles.' : metal === 'silver' ? '925 sterling silver bracelets, chains and more.' : 'Browse gold, silver and diamond jewellery at MPR JEWELLERY.');

  const { data, loading, error, reload } = useApi<ListResponse>(`/api/products?${params}`);

  const set = (k: string, v?: string | number) => {
    const n = new URLSearchParams(sp);
    if (v === undefined || v === '') n.delete(k);
    else n.set(k, String(v));
    setSp(n, { replace: true });
  };
  const setPrice = (min?: number, max?: number) => {
    const n = new URLSearchParams(sp);
    min === undefined ? n.delete('minPrice') : n.set('minPrice', String(min));
    max === undefined ? n.delete('maxPrice') : n.set('maxPrice', String(max));
    setSp(n, { replace: true });
  };
  const activeCount = ['category', 'metal', 'purity', 'minPrice', 'maxPrice', 'availability'].filter((k) => sp.get(k)).length;

  const filters = (
    <div className="space-y-7">
      <FilterGroup title="Category">
        <div className="flex flex-wrap gap-2">
          <button className={cls('chip', !sp.get('category') && 'chip-active')} onClick={() => set('category')}>All</button>
          {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
            <button key={k} className={cls('chip', sp.get('category') === k && 'chip-active')} onClick={() => set('category', sp.get('category') === k ? undefined : k)} data-testid={`filter-category-${k}`}>{l}</button>
          ))}
        </div>
      </FilterGroup>
      {!metal && (
        <FilterGroup title="Metal">
          <div className="flex flex-wrap gap-2">
            {['gold', 'silver', 'diamond', 'platinum'].map((k) => (
              <button key={k} className={cls('chip', sp.get('metal') === k && 'chip-active')} onClick={() => set('metal', sp.get('metal') === k ? undefined : k)} data-testid={`filter-metal-${k}`}>{METAL_LABELS[k]}</button>
            ))}
          </div>
        </FilterGroup>
      )}
      {!!data?.facets.purities.length && (
        <FilterGroup title="Purity">
          <div className="flex flex-wrap gap-2">
            {data.facets.purities.map((k) => (
              <button key={k} className={cls('chip', sp.get('purity') === k && 'chip-active')} onClick={() => set('purity', sp.get('purity') === k ? undefined : k)}>{k}</button>
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title="Price">
        <div className="flex flex-wrap gap-2">
          {PRICE_PRESETS.map(([l, mn, mx]) => {
            const active = sp.get('minPrice') === (mn?.toString() ?? null) && sp.get('maxPrice') === (mx?.toString() ?? null);
            return <button key={l} className={cls('chip', active && 'chip-active')} onClick={() => (active ? setPrice() : setPrice(mn, mx))}>{l}</button>;
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input type="number" min={0} inputMode="numeric" placeholder="Min ₹" className="input py-2 text-sm" defaultValue={sp.get('minPrice') || ''} key={`mn${sp.get('minPrice')}`} onBlur={(e) => set('minPrice', e.target.value)} aria-label="Minimum price" data-testid="input-min-price" />
          <span className="text-cocoa-50">–</span>
          <input type="number" min={0} inputMode="numeric" placeholder="Max ₹" className="input py-2 text-sm" defaultValue={sp.get('maxPrice') || ''} key={`mx${sp.get('maxPrice')}`} onBlur={(e) => set('maxPrice', e.target.value)} aria-label="Maximum price" data-testid="input-max-price" />
        </div>
      </FilterGroup>
      <FilterGroup title="Availability">
        <div className="flex flex-wrap gap-2">
          {Object.entries(AVAILABILITY_LABELS).map(([k, l]) => (
            <button key={k} className={cls('chip', sp.get('availability') === k && 'chip-active')} onClick={() => set('availability', sp.get('availability') === k ? undefined : k)}>{k === 'out_of_stock' ? 'Unavailable' : l}</button>
          ))}
        </div>
      </FilterGroup>
      {activeCount > 0 && (
        <button className="text-sm text-cocoa-100 underline underline-offset-4 hover:text-cocoa" onClick={() => setSp(q ? { q } : {}, { replace: true })} data-testid="button-clear-filters">Clear all filters</button>
      )}
    </div>
  );

  return (
    <div className="container-lux pt-10 sm:pt-14">
      <div className="flex flex-col gap-5 border-b border-cocoa/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">MPR JEWELLERY</p>
          <h1 className="mt-2 text-[34px] leading-tight sm:text-[40px]" data-testid="text-shop-title">{title}</h1>
          {data && <p className="mt-1 text-sm text-cocoa-50" data-testid="text-result-count">{data.total} {data.total === 1 ? 'piece' : 'pieces'}{data.facets.priceMax > 0 && !q ? ` · ${formatINR(data.facets.priceMin)} – ${formatINR(data.facets.priceMax)}` : ''}</p>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); set('q', qInput.trim()); }} className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-50" />
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search jewellery" className="input pl-10 pr-9" aria-label="Search jewellery" data-testid="input-shop-search" />
          {q && <button type="button" onClick={() => set('q')} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-50" aria-label="Clear search"><X className="h-4 w-4" /></button>}
        </form>
      </div>

      <div className="flex items-center justify-between gap-3 py-5">
        <button className="btn-outline btn-sm lg:hidden" onClick={() => setDrawer(true)} data-testid="button-open-filters"><SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ''}</button>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-cocoa-50 sm:inline">Sort</span>
          <Select value={sp.get('sort') || 'newest'} onChange={(e) => set('sort', e.target.value === 'newest' ? undefined : e.target.value)} className="w-44 py-2 text-sm" aria-label="Sort products" data-testid="select-sort">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name">Name</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">{filters}</aside>
        <div>
          {error && <ErrorNote message={error} onRetry={() => reload()} />}
          {loading && !data ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : data && data.items.length === 0 ? (
            <EmptyState icon={<Search className="h-5 w-5" />} title="No matching jewellery" text="Try another search or remove a filter." action={<button className="btn-outline btn-sm" onClick={() => setSp({}, { replace: true })}>Show all jewellery</button>} />
          ) : (
            <div className={cls('grid grid-cols-2 gap-x-4 gap-y-9 transition-opacity sm:gap-x-6 xl:grid-cols-3', loading && 'opacity-60')}>
              {data?.items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[85] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/45" onClick={() => setDrawer(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-fadeUp overflow-y-auto rounded-t-2xl bg-cream px-5 pb-8 pt-5 shadow-lift">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl">Filters</h2><button onClick={() => setDrawer(false)} className="rounded-full p-2 hover:bg-beige" aria-label="Close filters"><X className="h-5 w-5" /></button></div>
            {filters}
            <button className="btn-primary mt-8 w-full py-3" onClick={() => setDrawer(false)}>Show {data?.total ?? ''} results</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-cocoa-50">{title}</h3>
      {children}
    </div>
  );
}
