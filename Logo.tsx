import { cls } from '@/utils/format';

/** MPR mark: a faceted lozenge (gem) enclosing a lotus bud — heritage + brilliance. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden>
      <path d="M20 2.5 37.5 20 20 37.5 2.5 20Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M20 7.5 32.5 20 20 32.5 7.5 20Z" stroke="currentColor" strokeWidth="0.7" opacity=".55" />
      <path d="M20 12.2c3.4 2.9 4.5 5.6 4.5 8.1 0 3.1-2.1 5.6-4.5 6.9-2.4-1.3-4.5-3.8-4.5-6.9 0-2.5 1.1-5.2 4.5-8.1Z" fill="currentColor" />
      <path d="M13.2 22.4c2.3.2 4.6 1.6 6.8 4.8 2.2-3.2 4.5-4.6 6.8-4.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light, compact, name = 'MPR JEWELLERY', logoUrl }: { light?: boolean; compact?: boolean; name?: string; logoUrl?: string | null }) {
  const [first, ...rest] = name.split(' ');
  return (
    <span className={cls('inline-flex items-center gap-2.5', light ? 'text-cream' : 'text-cocoa')} aria-label={name}>
      {logoUrl ? <img src={logoUrl} alt="" className="h-9 w-9 rounded-md object-contain" /> : <LogoMark className={cls('h-9 w-9', light ? 'text-gold-light' : 'text-gold-deep')} />}
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[22px] font-bold tracking-[0.14em]">{first}</span>
          {rest.length > 0 && <span className={cls('mt-0.5 text-[9.5px] font-medium tracking-[0.42em]', light ? 'text-gold-light' : 'text-gold-deep')}>{rest.join(' ')}</span>}
        </span>
      )}
    </span>
  );
}
