import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, KeyRound, Menu, X, User, Home, Gem, LayoutGrid, Phone } from 'lucide-react';
import { Logo } from './Logo';
import { useCart } from '@/context/CartContext';
import { useSite } from '@/context/SiteContext';
import { useAuth } from '@/context/AuthContext';
import { cls } from '@/utils/format';
import { mediaUrl } from '@/services/api';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/jewellery', label: 'Jewellery' },
  { to: '/gold', label: 'Gold' },
  { to: '/silver', label: 'Silver' },
  { to: '/collections', label: 'Collections' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function Header() {
  const { count } = useCart();
  const { settings } = useSite();
  const { customer } = useAuth();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
  }, [menu]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-cocoa/[0.06] bg-cream/90 backdrop-blur-md">
        <div className="container-lux flex h-[68px] items-center gap-3">
          <button className="-ml-2 rounded-full p-2 text-cocoa lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu" data-testid="button-menu">
            <Menu className="h-[22px] w-[22px]" />
          </button>
          <Link to="/" className="mr-auto lg:mr-10" data-testid="link-home" aria-label="MPR JEWELLERY home">
            <Logo name={settings?.brand.name} logoUrl={settings?.brand.logoUrl ? mediaUrl(settings.brand.logoUrl) : null} />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} data-testid={`nav-${n.label.toLowerCase()}`}
                className={({ isActive }) => cls('relative rounded-full px-3.5 py-2 text-[14px] transition', isActive ? 'text-cocoa' : 'text-cocoa-100 hover:text-cocoa')}>
                {({ isActive }) => (<>{n.label}{isActive && <span className="absolute inset-x-3.5 -bottom-[1px] h-px bg-gold" />}</>)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-0.5">
            <IconBtn label="Search" onClick={() => setSearch((s) => !s)} testId="button-search"><Search className="h-[20px] w-[20px]" /></IconBtn>
            <Link to={customer ? '/account' : '/account/login'} className="hidden rounded-full p-2.5 text-cocoa transition hover:bg-beige/70 sm:inline-flex" aria-label="My account" data-testid="link-account"><User className="h-[20px] w-[20px]" /></Link>
            <Link to="/cart" className="relative rounded-full p-2.5 text-cocoa transition hover:bg-beige/70" aria-label={`Cart, ${count} items`} data-testid="link-cart">
              <ShoppingBag className="h-[20px] w-[20px]" />
              {count > 0 && <span data-testid="text-cart-count" className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10.5px] font-semibold text-ink">{count}</span>}
            </Link>
            <Link to="/owner/login" className="ml-1 hidden items-center gap-1.5 rounded-full border border-cocoa/15 px-3 py-1.5 text-[12.5px] text-cocoa-100 transition hover:border-gold hover:text-cocoa md:inline-flex" data-testid="link-owner-login">
              <KeyRound className="h-3.5 w-3.5" /> Owner
            </Link>
          </div>
        </div>
        {search && <SearchBar onClose={() => setSearch(false)} />}
      </header>

      {/* Mobile slide-in navigation */}
      {menu && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setMenu(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] animate-slideIn flex-col bg-cream shadow-lift">
            <div className="flex h-[68px] items-center justify-between border-b border-cocoa/5 px-5">
              <Logo name={settings?.brand.name} />
              <button onClick={() => setMenu(false)} className="rounded-full p-2 hover:bg-beige" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cls('flex items-center justify-between rounded-xl px-4 py-3.5 font-display text-[21px] transition', isActive ? 'bg-beige/70 text-cocoa' : 'text-cocoa-200 hover:bg-beige/40')}>
                  {n.label}
                </NavLink>
              ))}
              <div className="hairline my-4" />
              <Link to={customer ? '/account' : '/account/login'} className="flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] text-cocoa-200 hover:bg-beige/40"><User className="h-4 w-4" /> {customer ? 'My Account' : 'Sign in / Register'}</Link>
              <Link to="/track-order" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] text-cocoa-200 hover:bg-beige/40"><Gem className="h-4 w-4" /> Track an order</Link>
              <Link to="/owner/login" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] text-cocoa-200 hover:bg-beige/40"><KeyRound className="h-4 w-4" /> Owner Login</Link>
            </nav>
            {settings && (
              <div className="border-t border-cocoa/5 px-7 py-5 text-[13px] text-cocoa-50">
                <p>{settings.contact.phone}</p>
                <p>{settings.contact.email}</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function IconBtn({ children, label, onClick, testId }: { children: React.ReactNode; label: string; onClick: () => void; testId: string }) {
  return <button onClick={onClick} aria-label={label} data-testid={testId} className="rounded-full p-2.5 text-cocoa transition hover:bg-beige/70">{children}</button>;
}

function SearchBar({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/jewellery?q=${encodeURIComponent(q.trim())}`);
  };
  const quick = ['Gold', 'Silver', 'Diamond', 'Ring', 'Necklace', 'Bangle', 'Earrings', 'Chain'];
  return (
    <div className="animate-fadeUp border-t border-cocoa/5 bg-pearl">
      <form onSubmit={submit} className="container-lux flex items-center gap-3 py-3.5">
        <Search className="h-5 w-5 shrink-0 text-gold-deep" />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rings, necklaces, gold, silver…" className="flex-1 bg-transparent py-1.5 text-[16px] outline-none placeholder:text-cocoa-50/70" data-testid="input-search" aria-label="Search products" />
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-cocoa-50 hover:bg-beige" aria-label="Close search"><X className="h-5 w-5" /></button>
      </form>
      <div className="container-lux scrollbar-none flex gap-2 overflow-x-auto pb-3.5">
        {quick.map((t) => (
          <Link key={t} to={`/jewellery?q=${t.toLowerCase()}`} className="chip shrink-0">{t}</Link>
        ))}
      </div>
    </div>
  );
}

/** Compact bottom navigation for phones */
export function MobileBottomNav() {
  const { count } = useCart();
  const { customer } = useAuth();
  const items = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/jewellery', label: 'Shop', icon: LayoutGrid },
    { to: '/collections', label: 'Collections', icon: Gem },
    { to: '/cart', label: 'Cart', icon: ShoppingBag, badge: count },
    { to: customer ? '/account' : '/account/login', label: 'Account', icon: User },
  ];
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-cocoa/[0.07] bg-pearl/95 backdrop-blur-md md:hidden" aria-label="Quick">
      <div className="grid grid-cols-5">
        {items.map((i) => (
          <NavLink key={i.label} to={i.to} end={i.end} className={({ isActive }) => cls('relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] tracking-wide', isActive ? 'text-gold-deep' : 'text-cocoa-50')}>
            <i.icon className="h-[19px] w-[19px]" strokeWidth={1.7} />
            {i.label}
            {!!i.badge && <span className="absolute right-[calc(50%-18px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9.5px] font-semibold text-ink">{i.badge}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function ContactStrip() {
  const { settings } = useSite();
  if (!settings) return null;
  return (
    <a href={`tel:${settings.contact.phone}`} className="inline-flex items-center gap-2 text-sm text-cocoa-100 hover:text-cocoa"><Phone className="h-4 w-4" /> {settings.contact.phone}</a>
  );
}
