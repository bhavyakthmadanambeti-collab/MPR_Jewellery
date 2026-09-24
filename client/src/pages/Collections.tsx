import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Play, X } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useSeo } from '@/hooks/useSeo';
import type { Collection, CollectionMedia } from '@/types';
import { mediaUrl } from '@/services/api';
import { EmptyState, ErrorNote, LazyVideo, Skeleton } from '@/components/ui';
import { cls } from '@/utils/format';

/** Promotional collections — presentation only. No prices or Buy Now here by design. */
export default function Collections() {
  useSeo('Collections', 'Explore MPR JEWELLERY collections — bridal, festive, diamond and new designs.');
  const { data, loading, error, reload } = useApi<Collection[]>('/api/collections');
  return (
    <div className="container-lux pt-10 sm:pt-14">
      <p className="eyebrow">MPR JEWELLERY</p>
      <h1 className="mt-2 text-[36px] sm:text-[42px]">Collections</h1>
      <div className="hairline mb-10 mt-7" />
      {error && <ErrorNote message={error} onRetry={() => reload()} />}
      {loading && <div className="grid gap-5 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[16/11]" />)}</div>}
      {data && data.length === 0 && <EmptyState title="New collections coming soon" text="Please check back shortly." />}
      <div className="grid gap-5 md:grid-cols-2">
        {data?.map((c) => {
          const cover = c.media[0];
          return (
            <Link key={c.id} to={`/collections/${c.slug}`} className="group relative block aspect-[5/4] overflow-hidden rounded-2xl bg-cocoa shadow-soft sm:aspect-[16/11]" data-testid={`card-collection-${c.id}`}>
              {cover && (cover.type === 'image' ? <img src={mediaUrl(cover.url)} alt={cover.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-[1.2s] group-hover:scale-[1.03]" /> : <LazyVideo src={mediaUrl(cover.url)} poster={mediaUrl(cover.posterUrl)} autoPlay controls={false} className="absolute inset-0 h-full w-full object-cover" />)}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
                <div>
                  <h2 className="font-display text-[30px] text-cream">{c.title}</h2>
                  {c.description && <p className="mt-1 line-clamp-1 text-[14px] text-cream/70">{c.description}</p>}
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream/10 text-cream ring-1 ring-cream/25 transition group-hover:bg-gold group-hover:text-ink"><ArrowRight className="h-4 w-4" /></span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function CollectionDetail() {
  const { slug } = useParams();
  const { data: c, loading, error } = useApi<Collection>(`/api/collections/${slug}`);
  const [lightbox, setLightbox] = useState<CollectionMedia | null>(null);
  useSeo(c?.title || 'Collection', c?.description || undefined, c?.media[0]?.type === 'image' ? mediaUrl(c.media[0].url) : undefined);

  if (loading) return <div className="container-lux pt-14"><Skeleton className="h-10 w-64" /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div></div>;
  if (error || !c) return <div className="container-lux py-20"><EmptyState title="Collection not available" text={error || ''} action={<Link to="/collections" className="btn-primary">All collections</Link>} /></div>;

  return (
    <div className="container-lux pt-8 sm:pt-12">
      <Link to="/collections" className="inline-flex items-center gap-1.5 text-sm text-cocoa-50 hover:text-cocoa"><ArrowLeft className="h-4 w-4" /> All collections</Link>
      <div className="mt-5 max-w-2xl">
        <p className="eyebrow">Collection</p>
        <h1 className="mt-2 text-[38px] leading-tight sm:text-[46px]" data-testid="text-collection-title">{c.title}</h1>
        {c.description && <p className="mt-3 text-[16px] text-cocoa-100">{c.description}</p>}
      </div>
      <div className="hairline my-9" />
      {c.media.length === 0 ? <EmptyState title="Media coming soon" /> : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {c.media.map((m) => (
            <button key={m.id} onClick={() => setLightbox(m)} className="group relative block w-full break-inside-avoid overflow-hidden rounded-2xl bg-beige ring-1 ring-cocoa/5" aria-label={`Open ${m.type}`} data-testid={`media-${m.id}`}>
              {m.type === 'image' ? (
                <img src={mediaUrl(m.url)} alt={m.alt} loading="lazy" decoding="async" className="w-full transition duration-700 group-hover:scale-[1.02]" style={m.width && m.height ? { aspectRatio: `${m.width}/${m.height}` } : undefined} />
              ) : (
                <div className="relative aspect-video w-full bg-ink">
                  {m.posterUrl && <img src={mediaUrl(m.posterUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-cream/90 text-ink shadow-lift"><Play className="ml-0.5 h-6 w-6 fill-ink" /></span></span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      <p className="mt-8 text-center text-[13px] text-cocoa-50">Showcase imagery. For availability and prices, <Link to="/jewellery" className="underline underline-offset-4 hover:text-cocoa">browse our jewellery</Link> or <Link to="/contact" className="underline underline-offset-4 hover:text-cocoa">contact us</Link>.</p>

      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/90 p-4" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-cream/10 p-2 text-cream hover:bg-cream/20" aria-label="Close"><X className="h-5 w-5" /></button>
          <div className={cls('max-h-full max-w-5xl')} onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'image' ? <img src={mediaUrl(lightbox.url)} alt={lightbox.alt} className="max-h-[88vh] rounded-xl object-contain" /> : <video src={mediaUrl(lightbox.url)} poster={mediaUrl(lightbox.posterUrl) || undefined} controls autoPlay playsInline className="max-h-[88vh] rounded-xl" />}
          </div>
        </div>
      )}
    </div>
  );
}
