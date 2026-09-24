import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Smartphone, ShieldCheck } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useSite } from '@/context/SiteContext';
import { useToast } from '@/context/ToastContext';
import { useSeo } from '@/hooks/useSeo';
import { api, mediaUrl } from '@/services/api';
import type { OrderDetailResponse } from '@/types';
import { EmptyState, ErrorNote, Field, Input, Spinner, Textarea } from '@/components/ui';
import { Summary, useQuote } from './Cart';
import { formatINR } from '@/utils/format';
import { rememberOrder } from './OrderStatus';
import { STATIC_MODE } from '@/services/staticApi';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

type Form = { fullName: string; phone: string; email: string; address: string; city: string; state: string; pincode: string };
const empty: Form = { fullName: '', phone: '', email: '', address: '', city: '', state: 'Tamil Nadu', pincode: '' };

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.fullName.trim().length < 2) e.fullName = 'Enter your full name';
  if (!/^[6-9]\d{9}$/.test(f.phone.trim())) e.phone = 'Enter a valid 10-digit mobile number';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
  if (f.address.trim().length < 5) e.address = 'Enter your full address';
  if (f.city.trim().length < 2) e.city = 'Enter your city';
  if (!f.state) e.state = 'Choose your state';
  if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = 'Enter a valid 6-digit pincode';
  return e;
}

export default function Checkout() {
  useSeo('Checkout');
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const cart = useCart();
  const { customer } = useAuth();
  const { settings } = useSite();
  const { toast } = useToast();

  const buyId = Number(sp.get('buy'));
  const buyQty = Math.max(1, Math.min(20, Number(sp.get('qty')) || 1));
  const isBuyNow = Number.isInteger(buyId) && buyId > 0;
  const lines = useMemo(() => (isBuyNow ? [{ productId: buyId, quantity: buyQty }] : cart.lines), [isBuyNow, buyId, buyQty, cart.lines]);
  const { quote, error: quoteError, loading } = useQuote(lines);

  const [f, setF] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saveAddress, setSaveAddress] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    api<{ addresses: any[] }>('/api/customers/me').then((r) => {
      const a = r.addresses.find((x) => x.isDefault) || r.addresses[0];
      setF((cur) => ({ ...cur, fullName: a?.fullName || customer.name, phone: a?.phone || customer.phone || '', email: customer.email, address: a?.address || '', city: a?.city || '', state: a?.state || cur.state, pincode: a?.pincode || '' }));
    }).catch(() => {});
  }, [customer]);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(f);
    setErrors(v);
    if (Object.keys(v).length) {
      toast('Please check the highlighted fields.', 'error');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Only product IDs + quantities are sent. The server calculates every amount.
      const r = await api<OrderDetailResponse>('/api/orders', { body: { items: lines, ...f, saveAddress: !!customer && saveAddress } });
      if (!isBuyNow) cart.clear();
      rememberOrder(r.order.orderNumber, r.accessToken);
      toast('Your order was created successfully.');
      nav(`/order/${r.order.orderNumber}?t=${r.accessToken}`, { replace: true });
    } catch (err: any) {
      setSubmitError(err.message);
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!lines.length) return <div className="container-lux py-16"><EmptyState title="Nothing to check out" text="Add a piece to your cart first." action={<Link to="/jewellery" className="btn-primary">Shop jewellery</Link>} /></div>;

  return (
    <div className="container-lux pt-10 sm:pt-14">
      <p className="eyebrow flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Secure checkout</p>
      <h1 className="mt-2 text-[36px] sm:text-[40px]">Checkout</h1>

      {STATIC_MODE && (
        <div className="mt-6 rounded-2xl border border-gold/30 bg-[#F8F0DF] px-5 py-4 text-[14.5px] text-cocoa-200" data-testid="note-static-mode">
          <p className="font-medium">Online ordering is coming soon</p>
          <p className="mt-0.5">To order this piece now, please call or WhatsApp <a className="font-semibold underline underline-offset-4" href={`tel:${settings?.contact.phone || '9030957387'}`}>{settings?.contact.phone || '9030957387'}</a>.</p>
        </div>
      )}
      <form onSubmit={submit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-7">
            <h2 className="text-2xl">Delivery details</h2>
            {!customer && <p className="mt-1 text-[13.5px] text-cocoa-50">Checking out as a guest. <Link to="/account/login?next=/checkout" className="text-gold-dark underline underline-offset-4">Sign in</Link> to save your address and see orders in your account.</p>}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" error={errors.fullName}><Input value={f.fullName} onChange={set('fullName')} autoComplete="name" data-testid="input-fullname" /></Field>
              <Field label="Mobile Number" error={errors.phone}><Input value={f.phone} onChange={set('phone')} inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder="10-digit mobile" data-testid="input-phone" /></Field>
              <Field label="Email" error={errors.email} className="sm:col-span-2"><Input type="email" value={f.email} onChange={set('email')} autoComplete="email" data-testid="input-email" /></Field>
              <Field label="Address" error={errors.address} className="sm:col-span-2"><Textarea value={f.address} onChange={set('address')} rows={3} className="min-h-[88px]" autoComplete="street-address" placeholder="House / flat, street, area, landmark" data-testid="input-address" /></Field>
              <Field label="City" error={errors.city}><Input value={f.city} onChange={set('city')} autoComplete="address-level2" data-testid="input-city" /></Field>
              <Field label="State" error={errors.state}>
                <select className="input" value={f.state} onChange={set('state')} data-testid="select-state">{STATES.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Pincode" error={errors.pincode}><Input value={f.pincode} onChange={set('pincode')} inputMode="numeric" maxLength={6} autoComplete="postal-code" data-testid="input-pincode" /></Field>
            </div>
            {customer && (
              <label className="mt-5 flex items-center gap-2.5 text-sm text-cocoa-100"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-[#B8893B]" /> Save this address to my account</label>
            )}
          </section>

          <section className="card p-5 sm:p-7" aria-labelledby="pay-h">
            <h2 id="pay-h" className="text-2xl">Payment</h2>
            <div className="mt-5 flex items-start gap-4 rounded-xl border-2 border-gold/60 bg-cream px-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cocoa text-gold-light"><Smartphone className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="font-medium">UPI PAYMENT</p>
                <p className="mt-0.5 text-[13.5px] text-cocoa-100">Pay using any supported UPI app — Google Pay, PhonePe, Paytm, BHIM or others.</p>
                {settings && (
                  <p className="mt-2.5 text-[14px]"><span className="text-cocoa-50">UPI ID: </span><span className="break-all font-display text-[20px] font-bold text-cocoa" data-testid="text-checkout-upi">{settings.payment.upiId}</span></p>
                )}
                <p className="mt-1 text-[12.5px] text-cocoa-50">After you place the order you will see the exact amount, a PAY USING UPI button and a QR code.</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="mb-5 text-2xl">Order summary</h2>
          {quoteError && <div className="mb-4"><ErrorNote message={quoteError} /></div>}
          <ul className="mb-5 space-y-4">
            {(quote?.items || []).map((i) => (
              <li key={i.productId} className="flex gap-3" data-testid={`summary-item-${i.productId}`}>
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-beige">{i.thumbUrl && <img src={mediaUrl(i.thumbUrl)} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-medium">{i.name}</p>
                  <p className="text-[12.5px] text-cocoa-50">Qty {i.quantity} × {formatINR(i.unitPrice)}</p>
                </div>
                <p className="text-[14px] font-medium">{formatINR(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <Summary q={quote} loading={loading} />
          {submitError && <div className="mt-4"><ErrorNote message={submitError} /></div>}
          <button type="submit" disabled={submitting || !quote} className="btn-primary mt-6 w-full py-3.5 font-semibold tracking-wide" data-testid="button-place-order">
            {submitting ? <><Spinner /> Creating your order…</> : <>Place order & pay via UPI</>}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-cocoa-50"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Amount calculated securely by our server</p>
        </aside>
      </form>
    </div>
  );
}
