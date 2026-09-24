import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, PlusCircle, ClipboardList, Images, Coins, MessageSquare, Settings, LogOut, Menu, X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Logo } from '@/components/Logo';
import { PageLoader } from '@/components/ui';
import { cls } from '@/utils/format';

const NAV = [
  { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/owner/products', label: 'Products', icon: Package, end: true },
  { to: '/owner/products/add', label: 'Add Product', icon: PlusCircle },
  { to: '/owner/orders', label: 'Orders', icon: ClipboardList },
  { to: '/owner/collections', label: 'Home Collections', icon: Images },
  { to: '/owner/rates', label: 'Gold/Silver Rates', icon: Coins },
  { to: '/owner/messages', label: 'Customer Messages', icon: MessageSquare },
  { to: '/owner/settings', label: 'Settings', icon: Settings },
];

function SideNav({ onLogout }: { onLogout: () => void }) {
  const { owner } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Link to="/owner/dashboard"><Logo light /></Link>
        <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-gold-light/80">Owner Portal</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Owner">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} data-testid={`owner-nav-${n.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
            className={({ isActive }) => cls('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] transition', isActive ? 'bg-cream/[0.08] text-cream ring-1 ring-gold/25' : 'text-cream/65 hover:bg-cream/[0.05] hover:text-cream')}>
            {({ isActive }) => (<><n.icon className={cls('h-[18px] w-[18px]', isActive ? 'text-gold-light' : '')} strokeWidth={1.7} />{n.label}</>)}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-cream/10 p-3">
        <Link to="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] text-cream/60 hover:text-cream"><ExternalLink className="h-4 w-4" /> View website</Link>
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] text-cream/70 hover:bg-cream/[0.05] hover:text-cream" data-testid="button-owner-logout"><LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} /> Logout</button>
        {owner && <p className="truncate px-3.5 pt-2 text-[11.5px] text-cream/40">{owner.email}</p>}
      </div>
    </div>
  );
}

export function OwnerLayout() {
  const { owner, ownerReady, ownerLogout } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => {
    const prev = document.title;
    document.title = 'Owner Portal | MPR JEWELLERY';
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
    robots.content = 'noindex, nofollow';
    return () => { document.title = prev; robots?.remove(); };
  }, []);

  if (!ownerReady) return <PageLoader label="Checking your session…" />;
  if (!owner) return <Navigate to="/owner/login" replace state={{ from: loc.pathname }} />;

  const logout = () => { ownerLogout(); toast('You have been logged out.', 'info'); nav('/owner/login'); };
  const current = NAV.find((n) => loc.pathname.startsWith(n.to))?.label || 'Owner Portal';

  return (
    <div className="min-h-screen bg-cream-100 lg:pl-[260px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] bg-cocoa lg:block"><SideNav onLogout={logout} /></aside>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-cocoa/[0.06] bg-cream/90 px-4 backdrop-blur-md lg:hidden">
        <button onClick={() => setDrawer(true)} className="-ml-1 rounded-full p-2" aria-label="Open owner menu" data-testid="button-owner-menu"><Menu className="h-5 w-5" /></button>
        <p className="font-display text-[19px] font-semibold">{current}</p>
      </header>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[82%] max-w-[290px] animate-slideIn bg-cocoa shadow-lift">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-5 rounded-full p-2 text-cream/70" aria-label="Close menu"><X className="h-5 w-5" /></button>
            <SideNav onLogout={logout} />
          </aside>
        </div>
      )}
      <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9"><Outlet /></main>
    </div>
  );
}

export function OwnerPageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[30px] leading-tight sm:text-[34px]">{title}</h1>
        {sub && <p className="mt-1 text-[14px] text-cocoa-50">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
