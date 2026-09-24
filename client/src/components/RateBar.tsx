import { useState } from 'react';
import { Info } from 'lucide-react';
import { useSite } from '@/context/SiteContext';
import { formatDate, formatINR } from '@/utils/format';

export function RateBar() {
  const { rates } = useSite();
  const [open, setOpen] = useState(false);
  const r = (k: string) => rates?.rates.find((x) => x.key === k);
  const gold = ['gold_24k', 'gold_22k', 'gold_916', 'gold_18k'].map(r).filter(Boolean);
  const unit = (u?: string) => (u === 'carat' ? 'ct' : 'g');
  const sources = [...new Set(rates?.rates.map((x) => x.source).filter(Boolean))];

  return (
    <div className="relative bg-ink text-[12px] text-cream/85" data-testid="rate-bar">
      <div className="container-lux flex h-9 items-center gap-4">
        <div className="scrollbar-none flex flex-1 items-center gap-5 overflow-x-auto whitespace-nowrap">
          {!rates ? (
            <span className="text-cream/50">Loading today's rates…</span>
          ) : (
            <>
              <span className="flex items-center gap-3">
                <span className="font-semibold tracking-[0.16em] text-gold-light">GOLD</span>
                {gold.map((g) => (
                  <span key={g!.key} data-testid={`rate-${g!.key}`}>
                    <span className="text-cream/55">{g!.label.replace('Gold ', '')}</span> <span className="font-medium text-cream">{formatINR(g!.value)}</span><span className="text-cream/45">/{unit(g!.unit)}</span>
                  </span>
                ))}
              </span>
              <span className="h-3 w-px bg-cream/15" />
              <span data-testid="rate-silver"><span className="font-semibold tracking-[0.16em] text-[#D7D9DC]">SILVER</span> <span className="font-medium text-cream">{formatINR(r('silver')?.value)}</span><span className="text-cream/45">/g</span></span>
              <span className="h-3 w-px bg-cream/15" />
              <span data-testid="rate-diamond"><span className="font-semibold tracking-[0.16em] text-[#E9E4F2]">DIAMOND</span> <span className="font-medium text-cream">{formatINR(r('diamond')?.value)}</span><span className="text-cream/45">/ct</span></span>
            </>
          )}
        </div>
        {rates && (
          <button onClick={() => setOpen((o) => !o)} className="flex shrink-0 items-center gap-1.5 text-cream/60 hover:text-cream" aria-expanded={open} data-testid="button-rate-info">
            <Info className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{rates.mode === 'api' ? 'Provider rate' : 'Stored rate'} · Updated {formatDate(rates.lastUpdated)}</span>
          </button>
        )}
      </div>
      {open && rates && (
        <div className="absolute right-4 top-9 z-50 w-[min(92vw,340px)] animate-fadeUp rounded-xl bg-pearl p-4 text-[13px] text-cocoa shadow-lift ring-1 ring-cocoa/10">
          <p className="font-medium">{rates.label}</p>
          <p className="mt-1 text-cocoa-50">Last updated: {formatDate(rates.lastUpdated)}</p>
          <p className="mt-1 text-cocoa-50">Rate source: {sources.join(', ') || '—'}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-cocoa-50">Indicative metal rates for reference. Product prices are fixed by MPR JEWELLERY and shown on each product.</p>
        </div>
      )}
    </div>
  );
}
