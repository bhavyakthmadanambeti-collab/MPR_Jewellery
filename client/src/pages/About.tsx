import { Link } from 'react-router-dom';
import { ShieldCheck, Hammer, HeartHandshake, Phone, Mail, MapPin } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { useSite } from '@/context/SiteContext';
import { asset } from '@/utils/asset';

export default function About() {
  useSeo('About MPR JEWELLERY', 'MPR JEWELLERY — hallmarked gold, sterling silver and diamond jewellery, crafted with care in Tamil Nadu.');
  const { settings } = useSite();
  const pillars = [
    { icon: ShieldCheck, t: 'Quality', d: 'BIS-hallmarked gold and 925 sterling silver. Weight and purity are listed for every piece.' },
    { icon: Hammer, t: 'Craftsmanship', d: 'Finished by skilled artisans — from temple motifs to modern everyday designs.' },
    { icon: HeartHandshake, t: 'Customer trust', d: 'Clear pricing, owner-verified payments and personal support on every order.' },
  ];
  return (
    <div>
      <section className="container-lux grid items-center gap-10 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="eyebrow">Our story</p>
          <h1 className="mt-3 text-[40px] leading-[1.08] sm:text-[48px]">About MPR JEWELLERY</h1>
          <div className="mt-5 h-px w-20 bg-gold-gradient" />
          <p className="mt-6 text-[16.5px] leading-relaxed text-cocoa-100">MPR JEWELLERY brings fine gold, silver and diamond jewellery to families who value honest craftsmanship. Every design is chosen for how it will be worn and treasured — for weddings, festivals and every day in between.</p>
          <p className="mt-4 text-[16.5px] leading-relaxed text-cocoa-100">We keep things simple: transparent weight and purity, fair prices set by us, and a team you can call.</p>
        </div>
        <div className="overflow-hidden rounded-2xl shadow-lift ring-1 ring-cocoa/5">
          <img src={asset('about-craft.webp')} alt="Artisan engraving a gold bangle" className="aspect-[4/5] w-full object-cover sm:aspect-[4/3] lg:aspect-[4/5]" />
        </div>
      </section>

      <section className="container-lux pt-20">
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.t} className="card p-7">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-beige text-gold-deep"><p.icon className="h-5 w-5" /></span>
              <h2 className="mt-5 text-[24px]">{p.t}</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-cocoa-100">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {settings && (
        <section className="container-lux pt-20">
          <div className="flex flex-col gap-6 rounded-2xl bg-cocoa p-8 text-cream sm:p-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-[30px] text-cream">Visit or reach us</h2>
              <div className="mt-4 space-y-2 text-[14.5px] text-cream/75">
                <p className="flex items-center gap-2.5"><MapPin className="h-4 w-4 text-gold-light" /> {settings.contact.address}</p>
                <p className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-gold-light" /> {settings.contact.phone}</p>
                <p className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-gold-light" /> {settings.contact.email}</p>
              </div>
            </div>
            <Link to="/contact" className="btn-gold self-start px-6 py-3 md:self-auto">Send us a message</Link>
          </div>
        </section>
      )}
    </div>
  );
}
