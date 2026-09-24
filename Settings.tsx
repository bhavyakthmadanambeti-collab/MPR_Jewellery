import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Save, ArrowUp, ArrowDown, Upload, Trash2, KeyRound, ShieldAlert } from 'lucide-react';
import { api, mediaUrl, upload } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { useSite } from '@/context/SiteContext';
import type { Collection, HomeSection } from '@/types';
import { OwnerPageHeader } from '@/layouts/OwnerLayout';
import { ErrorNote, Field, Input, PageLoader, Select, Spinner, Textarea, Toggle } from '@/components/ui';
import { LogoMark } from '@/components/Logo';

interface OwnerSettings {
  brand: { name: string; tagline: string; logoUrl: string | null };
  contact: { phone: string; email: string; address: string; whatsapp: string; hours: string };
  payment: { upiId: string; upiDisplayName: string; upiPhone: string; instructions: string; supportMessage: string };
  commerce: { currency: string; delivery: { flatCharge: number; freeAbove: number }; tax: { mode: 'none' | 'inclusive' | 'exclusive'; ratePercent: number; label: string } };
  home: { heroCollectionId: number | null; heroEyebrow: string; heroSubtitle: string; sections: HomeSection[] };
}
const SECTION_LABELS: Record<string, string> = { hero: 'Hero banner', categories: 'Shop by category', showcase: 'Collection showcase', featured: 'Featured products', collections: 'Collections grid', craft: 'Craftsmanship & trust' };

function Card({ title, sub, children, onSave, busy, testId }: { title: string; sub?: string; children: ReactNode; onSave: () => void; busy: boolean; testId: string }) {
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSave(); }} className="card space-y-4 p-5 sm:p-6">
      <div><h2 className="text-xl">{title}</h2>{sub && <p className="text-[13px] text-cocoa-50">{sub}</p>}</div>
      {children}
      <div className="flex justify-end"><button className="btn-primary btn-sm" disabled={busy} data-testid={testId}>{busy ? <Spinner /> : <Save className="h-4 w-4" />} Save</button></div>
    </form>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { refresh } = useSite();
  const [s, setS] = useState<OwnerSettings | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api<OwnerSettings>('/api/owner/settings'), api<{ items: Collection[] }>('/api/owner/collections')])
      .then(([st, c]) => { setS(st); setCols(c.items); })
      .catch((e) => setErr(e.message));
  }, []);

  const save = async (section: keyof OwnerSettings, body: unknown, msg: string) => {
    setBusy(section);
    try {
      const r = await api<OwnerSettings>('/api/owner/settings', { method: 'PUT', body: { [section]: body } });
      setS(r);
      refresh();
      toast(msg);
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(null); }
  };

  if (err) return <ErrorNote message={err} />;
  if (!s) return <PageLoader />;
  const up = <K extends keyof OwnerSettings>(k: K, v: Partial<OwnerSettings[K]>) => setS({ ...s, [k]: { ...s[k], ...v } });
  const moveSection = (i: number, d: -1 | 1) => {
    const j = i + d;
    const arr = [...s.home.sections];
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    up('home', { sections: arr });
  };

  return (
    <div>
      <OwnerPageHeader title="Settings" sub="Store details, payments, pricing rules and homepage layout." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Brand" onSave={() => save('brand', { name: s.brand.name, tagline: s.brand.tagline }, 'Brand details saved.')} busy={busy === 'brand'} testId="button-save-brand">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-cocoa text-gold-light">
              {s.brand.logoUrl ? <img src={mediaUrl(s.brand.logoUrl)} alt="Logo" className="h-full w-full object-contain" /> : <LogoMark className="h-9 w-9" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline btn-sm" onClick={() => logoInput.current?.click()} data-testid="button-upload-logo">{busy === 'logo' ? <Spinner /> : <Upload className="h-4 w-4" />} Upload logo</button>
              {s.brand.logoUrl && <button type="button" className="btn-ghost btn-sm text-danger" onClick={async () => { setBusy('logo'); try { setS(await api<OwnerSettings>('/api/owner/settings/logo', { method: 'DELETE' })); refresh(); toast('Logo removed. The default mark is shown.'); } finally { setBusy(null); } }}><Trash2 className="h-4 w-4" /> Remove</button>}
            </div>
            <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              setBusy('logo');
              const fd = new FormData(); fd.append('logo', f);
              try { setS(await upload<OwnerSettings>('/api/owner/settings/logo', fd)); refresh(); toast('Logo updated.'); } catch (er: any) { toast(er.message, 'error'); } finally { setBusy(null); }
            }} />
          </div>
          <Field label="Brand name"><Input value={s.brand.name} onChange={(e) => up('brand', { name: e.target.value })} data-testid="input-brand-name" /></Field>
          <Field label="Tagline"><Input value={s.brand.tagline} onChange={(e) => up('brand', { tagline: e.target.value })} /></Field>
        </Card>

        <Card title="Contact details" onSave={() => save('contact', s.contact, 'Contact details saved.')} busy={busy === 'contact'} testId="button-save-contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact phone"><Input value={s.contact.phone} onChange={(e) => up('contact', { phone: e.target.value })} /></Field>
            <Field label="WhatsApp number"><Input value={s.contact.whatsapp} onChange={(e) => up('contact', { whatsapp: e.target.value })} /></Field>
            <Field label="Contact email" className="sm:col-span-2"><Input type="email" value={s.contact.email} onChange={(e) => up('contact', { email: e.target.value })} /></Field>
            <Field label="Shop address" className="sm:col-span-2"><Textarea value={s.contact.address} onChange={(e) => up('contact', { address: e.target.value })} className="min-h-[70px]" /></Field>
            <Field label="Opening hours" className="sm:col-span-2"><Input value={s.contact.hours} onChange={(e) => up('contact', { hours: e.target.value })} /></Field>
          </div>
        </Card>

        <Card title="UPI payment" sub="Shown to customers at checkout. The amount is always calculated by the server." onSave={() => save('payment', s.payment, 'Payment settings saved.')} busy={busy === 'payment'} testId="button-save-payment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="UPI ID"><Input value={s.payment.upiId} onChange={(e) => up('payment', { upiId: e.target.value })} data-testid="input-upi-id" /></Field>
            <Field label="UPI display name"><Input value={s.payment.upiDisplayName} onChange={(e) => up('payment', { upiDisplayName: e.target.value })} /></Field>
            <Field label="UPI phone number"><Input value={s.payment.upiPhone} onChange={(e) => up('payment', { upiPhone: e.target.value })} inputMode="numeric" maxLength={10} /></Field>
            <Field label="Payment instructions" className="sm:col-span-2"><Textarea value={s.payment.instructions} onChange={(e) => up('payment', { instructions: e.target.value })} className="min-h-[80px]" /></Field>
            <Field label="Payment support message" className="sm:col-span-2"><Textarea value={s.payment.supportMessage} onChange={(e) => up('payment', { supportMessage: e.target.value })} className="min-h-[70px]" /></Field>
          </div>
          <p className="flex items-start gap-2 text-[12.5px] text-cocoa-50"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Never enter UPI PINs, OTPs or bank passwords anywhere — the system rejects them.</p>
        </Card>

        <Card title="Pricing rules" onSave={() => save('commerce', { currency: 'INR', delivery: { flatCharge: Number(s.commerce.delivery.flatCharge), freeAbove: Number(s.commerce.delivery.freeAbove) }, tax: { ...s.commerce.tax, ratePercent: Number(s.commerce.tax.ratePercent) } }, 'Pricing rules saved.')} busy={busy === 'commerce'} testId="button-save-commerce">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency"><Select value="INR" disabled><option value="INR">INR (₹)</option></Select></Field>
            <div />
            <Field label="Delivery charge (₹)"><Input type="number" min={0} value={s.commerce.delivery.flatCharge} onChange={(e) => up('commerce', { delivery: { ...s.commerce.delivery, flatCharge: e.target.value as any } })} data-testid="input-delivery-charge" /></Field>
            <Field label="Free delivery above (₹)" hint="0 = never free"><Input type="number" min={0} value={s.commerce.delivery.freeAbove} onChange={(e) => up('commerce', { delivery: { ...s.commerce.delivery, freeAbove: e.target.value as any } })} /></Field>
            <Field label="Tax">
              <Select value={s.commerce.tax.mode} onChange={(e) => up('commerce', { tax: { ...s.commerce.tax, mode: e.target.value as any } })}>
                <option value="inclusive">Included in product prices</option><option value="exclusive">Added at checkout</option><option value="none">No tax</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rate %"><Input type="number" min={0} max={40} step="0.01" value={s.commerce.tax.ratePercent} onChange={(e) => up('commerce', { tax: { ...s.commerce.tax, ratePercent: e.target.value as any } })} /></Field>
              <Field label="Label"><Input value={s.commerce.tax.label} onChange={(e) => up('commerce', { tax: { ...s.commerce.tax, label: e.target.value } })} /></Field>
            </div>
          </div>
        </Card>

        <Card title="Homepage" sub="Choose the hero collection, hero text and section order." onSave={() => save('home', s.home, 'Homepage settings saved.')} busy={busy === 'home'} testId="button-save-home">
          <Field label="Hero collection">
            <Select value={s.home.heroCollectionId ?? ''} onChange={(e) => up('home', { heroCollectionId: e.target.value ? Number(e.target.value) : null })} data-testid="select-hero-collection">
              <option value="">None (use brand banner)</option>
              {cols.map((c) => <option key={c.id} value={c.id}>{c.title}{!c.isPublished ? ' (draft)' : ''}</option>)}
            </Select>
          </Field>
          <Field label="Hero small heading"><Input value={s.home.heroEyebrow} onChange={(e) => up('home', { heroEyebrow: e.target.value })} /></Field>
          <Field label="Hero subtitle"><Input value={s.home.heroSubtitle} onChange={(e) => up('home', { heroSubtitle: e.target.value })} /></Field>
          <div>
            <span className="label">Sections</span>
            <ul className="divide-y divide-cocoa/5 rounded-xl ring-1 ring-cocoa/[0.08]">
              {s.home.sections.map((sec, i) => (
                <li key={sec.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <Toggle checked={sec.enabled} onChange={(v) => up('home', { sections: s.home.sections.map((x) => (x.key === sec.key ? { ...x, enabled: v } : x)) })} label={SECTION_LABELS[sec.key] || sec.key} />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="rounded-full p-1.5 text-cocoa-50 hover:bg-beige disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveSection(i, 1)} disabled={i === s.home.sections.length - 1} className="rounded-full p-1.5 text-cocoa-50 hover:bg-beige disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <PasswordCard />
      </div>
    </div>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (f.newPassword.length < 8) return setErr('New password must be at least 8 characters.');
    if (f.newPassword !== f.confirm) return setErr('New passwords do not match.');
    setBusy(true);
    try {
      const r = await api<{ message: string }>('/api/owner/password', { method: 'PUT', body: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      toast(r.message);
      setF({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
      <div><h2 className="flex items-center gap-2 text-xl"><KeyRound className="h-5 w-5 text-gold-deep" /> Change password</h2><p className="text-[13px] text-cocoa-50">Passwords are stored as secure hashes only.</p></div>
      <Field label="Current password"><Input type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} data-testid="input-current-password" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password"><Input type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} data-testid="input-new-password" /></Field>
        <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      </div>
      {err && <ErrorNote message={err} />}
      <div className="flex justify-end"><button className="btn-primary btn-sm" disabled={busy} data-testid="button-change-password">{busy && <Spinner />} Update password</button></div>
    </form>
  );
}
