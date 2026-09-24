import { useState, type FormEvent } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { useSite } from '@/context/SiteContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/services/api';
import { ErrorNote, Field, Input, Spinner, Textarea } from '@/components/ui';

export default function Contact() {
  useSeo('Contact MPR JEWELLERY', 'Call, WhatsApp or message MPR JEWELLERY for orders, custom designs and support.');
  const { settings } = useSite();
  const { toast } = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (f.name.trim().length < 2) v.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = 'Enter a valid email';
    if (f.phone && !/^[0-9+\s-]{10,15}$/.test(f.phone)) v.phone = 'Enter a valid phone number';
    if (f.message.trim().length < 5) v.message = 'Please write a short message';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ message: string }>('/api/messages', { body: f });
      toast(r.message);
      setSent(true);
      setF({ name: '', email: '', phone: '', message: '' });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="container-lux pt-12 sm:pt-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div>
          <p className="eyebrow">We're here to help</p>
          <h1 className="mt-3 text-[40px] leading-tight sm:text-[46px]">Contact us</h1>
          <p className="mt-4 max-w-md text-[16px] text-cocoa-100">Questions about a piece, an order, or a custom design? Send us a message and we'll respond soon.</p>
          {settings && (
            <ul className="mt-9 space-y-5 text-[15px]">
              <li className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-beige text-gold-deep"><Phone className="h-4 w-4" /></span><div><p className="text-[12px] uppercase tracking-[0.14em] text-cocoa-50">Phone / WhatsApp</p><a href={`tel:${settings.contact.phone}`} className="font-medium hover:text-gold-dark">{settings.contact.phone}</a></div></li>
              <li className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-beige text-gold-deep"><Mail className="h-4 w-4" /></span><div><p className="text-[12px] uppercase tracking-[0.14em] text-cocoa-50">Email</p><a href={`mailto:${settings.contact.email}`} className="break-all font-medium hover:text-gold-dark">{settings.contact.email}</a></div></li>
              <li className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-beige text-gold-deep"><MapPin className="h-4 w-4" /></span><div><p className="text-[12px] uppercase tracking-[0.14em] text-cocoa-50">Address</p><p className="font-medium">{settings.contact.address}</p></div></li>
              <li className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-beige text-gold-deep"><Clock className="h-4 w-4" /></span><div><p className="text-[12px] uppercase tracking-[0.14em] text-cocoa-50">Hours</p><p className="font-medium">{settings.contact.hours}</p></div></li>
            </ul>
          )}
        </div>
        <div className="card p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center py-12 text-center" data-testid="text-message-sent">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <h2 className="mt-4 text-2xl">Message sent</h2>
              <p className="mt-1.5 text-sm text-cocoa-100">Thank you for writing to us. We will get back to you soon.</p>
              <button className="btn-outline btn-sm mt-6" onClick={() => setSent(false)}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name}><Input value={f.name} onChange={set('name')} autoComplete="name" data-testid="input-contact-name" /></Field>
              <Field label="Phone" error={errors.phone}><Input value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" data-testid="input-contact-phone" /></Field>
              <Field label="Email" error={errors.email} className="sm:col-span-2"><Input type="email" value={f.email} onChange={set('email')} autoComplete="email" data-testid="input-contact-email" /></Field>
              <Field label="Message" error={errors.message} className="sm:col-span-2"><Textarea value={f.message} onChange={set('message')} rows={6} data-testid="input-contact-message" /></Field>
              {err && <div className="sm:col-span-2"><ErrorNote message={err} /></div>}
              <button className="btn-primary py-3 sm:col-span-2" disabled={busy} data-testid="button-send-message">{busy ? <Spinner /> : <Send className="h-4 w-4" />} Send Message</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
