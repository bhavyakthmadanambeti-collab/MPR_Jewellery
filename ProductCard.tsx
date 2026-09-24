import { Link } from 'react-router-dom';
import type { Product } from '@/types';
import { mediaUrl } from '@/services/api';
import { formatINR, AVAILABILITY_LABELS } from '@/utils/format';

export function ProductCard({ p }: { p: Product }) {
  const img = p.images[0];
  const second = p.images[1];
  return (
    <Link to={`/products/${p.slug}`} className="group block" data-testid={`card-product-${p.id}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-beige shadow-soft ring-1 ring-cocoa/5">
        {img ? (
          <>
            <img src={mediaUrl(img.thumbUrl)} alt={img.alt || p.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
            {second && <img src={mediaUrl(second.thumbUrl)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />}
          </>
        ) : (
          <div className="grid h-full place-items-center text-sm text-cocoa-50">No image yet</div>
        )}
        {p.availability !== 'in_stock' && (
          <span className="absolute left-3 top-3 rounded-full bg-pearl/95 px-2.5 py-1 text-[11px] font-medium text-cocoa-200 shadow-soft">{AVAILABILITY_LABELS[p.availability]}</span>
        )}
        {p.videos.length > 0 && <span className="absolute right-3 top-3 rounded-full bg-ink/60 px-2.5 py-1 text-[10.5px] tracking-wide text-cream backdrop-blur">VIDEO</span>}
      </div>
      <div className="px-1 pt-3.5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-gold-deep">{p.purity || p.metalType} · {p.weightGrams} g</p>
        <h3 className="mt-1 line-clamp-1 font-display text-[19px] font-semibold leading-snug text-cocoa group-hover:text-gold-dark">{p.name}</h3>
        <p className="mt-0.5 text-[15px] font-medium text-cocoa" data-testid={`text-price-${p.id}`}>{formatINR(p.price)}</p>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[4/5] rounded-2xl" />
      <div className="skeleton mt-3.5 h-3 w-24" />
      <div className="skeleton mt-2 h-5 w-3/4" />
      <div className="skeleton mt-2 h-4 w-20" />
    </div>
  );
}
