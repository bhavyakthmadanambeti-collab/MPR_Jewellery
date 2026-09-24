import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, Clock } from 'lucide-react';
import { Logo } from './Logo';
import { useSite } from '@/context/SiteContext';

export function Footer() {
  const { settings } = useSite();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-cocoa text-cream/80">
      <div className="hairline opacity-60" />
      <div className="container-lux grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <Logo light name={settings?.brand.name} />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-cream/60">{settings?.brand.tagline}</p>
        </div>
        <div>
          <h3 className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light">Shop</h3>
          <ul className="space-y-2.5 text-[14px]">
            {[['Gold', '/gold'], ['Silver', '/silver'], ['Diamond', '/jewellery?category=diamond'], ['All jewellery', '/jewellery'], ['Collections', '/collections']].map(([l, h]) => (
              <li key={l}><Link to={h} className="hover:text-cream">{l}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light">Help</h3>
          <ul className="space-y-2.5 text-[14px]">
            {[['Track your order', '/track-order'], ['My account', '/account'], ['About us', '/about'], ['Contact', '/contact'], ['Owner login', '/owner/login']].map(([l, h]) => (
              <li key={l}><Link to={h} className="hover:text-cream">{l}</Link></li>
            ))}
          </ul>
        </div>
        {settings && (
          <div className="space-y-3 text-[14px]">
            <h3 className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light">Visit & contact</h3>
            <p className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-light" />{settings.contact.address}</p>
            <p className="flex gap-2.5"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-light" /><a href={`tel:${settings.contact.phone}`} className="hover:text-cream">{settings.contact.phone}</a></p>
            <p className="flex gap-2.5"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-light" /><a href={`mailto:${settings.contact.email}`} className="break-all hover:text-cream">{settings.contact.email}</a></p>
            <p className="flex gap-2.5"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-light" />{settings.contact.hours}</p>
          </div>
        )}
      </div>
      <div className="border-t border-cream/10">
        <div className="container-lux flex flex-col gap-2 py-5 pb-24 text-[12.5px] text-cream/45 sm:flex-row sm:justify-between md:pb-5">
          <p>© {year} {settings?.brand.name || 'MPR JEWELLERY'}. All rights reserved.</p>
          <p>Secure UPI payments · Prices set by MPR JEWELLERY</p>
        </div>
      </div>
    </footer>
  );
}
