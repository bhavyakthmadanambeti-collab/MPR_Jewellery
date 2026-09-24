import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { RateBar } from '@/components/RateBar';
import { Header, MobileBottomNav } from '@/components/Header';
import { Footer } from '@/components/Footer';

export function CustomerLayout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-pearl focus:px-4 focus:py-2">Skip to content</a>
      <RateBar />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
