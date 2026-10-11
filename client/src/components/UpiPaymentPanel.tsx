import { useState } from 'react';
import { Copy, Check, Smartphone, ShieldCheck, QrCode, BadgeCheck, Clock } from 'lucide-react';
import type { Order, PaymentInstructions } from '@/types';
import { formatINR } from '@/utils/format';
import { Spinner } from './ui';

function copyText(t: string) {
  try {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t);
  } catch {
    /* fall through */
  }
  const ta = document.createElement('textarea');
  ta.value = t;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* ignore */
  }
  ta.remove();
  return Promise.resolve();
}

const UA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const IS_IOS = /iPad|iPhone|iPod/.test(UA) || (/Macintosh/.test(UA) && typeof document !== 'undefined' && 'ontouchend' in document);
const IS_ANDROID = /Android/i.test(UA);
const IS_MOBILE = IS_IOS || IS_ANDROID;
/** WhatsApp / Instagram / Facebook in-app browsers often block upi:// links. */
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(UA);

const UPI_APPS = [
  { name: 'Google Pay', ios: 'gpay://upi/pay', pkg: 'com.google.android.apps.nbu.paisa.user' },
  { name: 'PhonePe', ios: 'phonepe://pay', pkg: 'com.phonepe.app' },
  { name: 'Paytm', ios: 'paytmmp://pay', pkg: 'net.one97.paytm' },
  { name: 'BHIM', ios: 'bhim://upi/pay', pkg: 'in.org.npci.upiapp' },
];

/** Per-app deep link: iOS custom scheme, Android intent:// (works inside more browsers), else generic upi://. */
function appHref(upiLink: string, app: (typeof UPI_APPS)[number]) {
  const q = upiLink.split('?')[1] || '';
  if (IS_IOS) return `${app.ios}?${q}`;
  if (IS_ANDROID) return `intent://pay?${q}#Intent;scheme=upi;package=${app.pkg};S.browser_fallback_url=${encodeURIComponent(window.location.href)};end`;
  return upiLink;
}

export function UpiPaymentPanel({ order, pay, onConfirm, confirming }: { order: Order; pay: PaymentInstructions; onConfirm: (reference: string) => void; confirming: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const copy = async (label: string, v: string) => {
    await copyText(v);
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-pearl shadow-lift ring-1 ring-gold/25" data-testid="section-upi-payment" aria-labelledby="upi-title">
      <div className="bg-cocoa px-5 py-5 text-cream sm:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-light">Payment · UPI</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 id="upi-title" className="font-display text-[26px] text-cream">Pay {formatINR(pay.amount, true)}</h2>
          <span className="text-[13px] text-cream/60">Order {order.orderNumber}</span>
        </div>
        {order.paymentStatus === 'failed' && <p className="mt-2 rounded-lg bg-danger/30 px-3 py-2 text-[13px] text-cream">The previous payment could not be verified. You can pay again below, or contact us.</p>}
      </div>

      <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="rounded-xl border border-gold/30 bg-cream px-4 py-3.5">
            <p className="text-[12px] uppercase tracking-[0.14em] text-cocoa-50">{pay.payeeName} UPI ID</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="break-all font-display text-[26px] font-bold leading-tight text-cocoa" data-testid="text-upi-id">{pay.upiId}</p>
              <button onClick={() => copy('id', pay.upiId)} className="btn-outline btn-sm shrink-0" data-testid="button-copy-upi">
                {copied === 'id' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied === 'id' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            <p><span className="text-cocoa-50">UPI registered phone: </span><span className="font-medium" data-testid="text-upi-phone">{pay.upiPhone}</span></p>
            <p><span className="text-cocoa-50">Amount: </span><span className="font-medium">{formatINR(pay.amount, true)}</span></p>
          </div>

          {pay.upiAllowed === false ? (
            <div className="rounded-xl border border-warning/30 bg-[#FBF4E4] px-4 py-3.5 text-[14px] text-cocoa-200" data-testid="note-upi-limit">
              <p className="font-medium text-cocoa">This amount is above the UPI limit of {formatINR(pay.upiMaxAmount ?? 100000)}.</p>
              <p className="mt-1">UPI apps will decline this payment. Please call or WhatsApp us with your Order ID to pay by bank transfer (NEFT / RTGS / IMPS), or pay part as an advance by UPI and the balance in store.</p>
            </div>
          ) : (
            <>
              <a href={pay.upiLink} className="btn-gold w-full py-3.5 text-[15px] font-semibold tracking-wide" data-testid="button-pay-upi">
                <Smartphone className="h-[18px] w-[18px]" /> PAY USING ANY UPI APP
              </a>
              {IS_MOBILE && (
                <div>
                  <p className="text-[13px] text-cocoa-100">Or open a specific app</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {UPI_APPS.map((a) => (
                      <a key={a.name} href={appHref(pay.upiLink, a)} className="btn-outline btn-sm justify-center py-2.5" data-testid={`button-pay-${a.name.toLowerCase().replace(/\s/g, '')}`}>{a.name}</a>
                    ))}
                  </div>
                </div>
              )}
              {IN_APP_BROWSER && (
                <p className="rounded-lg bg-beige/70 px-3 py-2 text-[12.5px] text-cocoa-200">If the buttons don't open your UPI app, tap ⋮ and choose "Open in Chrome" / "Open in Safari", or copy the UPI ID above and pay from your app.</p>
              )}
              {!IS_MOBILE && <p className="text-[13px] text-cocoa-100">On a computer, scan the QR code with your phone's UPI app.</p>}
            </>
          )}
          <p className="text-[13px] leading-relaxed text-cocoa-50">{pay.instructions}</p>
        </div>

        {pay.qrSvg && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-[200px] rounded-xl bg-pearl p-3 ring-1 ring-cocoa/10" dangerouslySetInnerHTML={{ __html: pay.qrSvg }} aria-label="UPI QR code" data-testid="img-upi-qr" />
            <p className="flex items-center gap-1.5 text-[12px] text-cocoa-50"><QrCode className="h-3.5 w-3.5" /> Scan with any UPI app</p>
          </div>
        )}
      </div>

      <div className="border-t border-cocoa/5 bg-cream/60 p-5 sm:p-7">
        <label className="label" htmlFor="utr">UPI transaction reference / UTR (optional)</label>
        <input id="utr" className="input" maxLength={60} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 412345678901" data-testid="input-utr" />
        <button onClick={() => onConfirm(ref)} disabled={confirming} className="btn-primary mt-4 w-full py-3.5 text-[15px] font-semibold tracking-wide" data-testid="button-confirm-payment">
          {confirming ? <Spinner /> : <BadgeCheck className="h-[18px] w-[18px]" />} I HAVE MADE THE PAYMENT
        </button>
        <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-cocoa-50">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          We never ask for your UPI PIN, OTP or bank password. Your payment is confirmed only after MPR JEWELLERY verifies it in its UPI/bank records.
        </p>
        <p className="mt-1.5 text-[12.5px] text-cocoa-50">{pay.supportMessage}</p>
      </div>
    </section>
  );
}

export function PendingVerificationNote() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-[#FBF4E4] px-5 py-4" data-testid="note-pending-verification">
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div>
        <p className="font-medium text-cocoa">Payment is awaiting owner verification.</p>
        <p className="mt-0.5 text-[14px] text-cocoa-100">Your payment confirmation has been submitted. The owner will verify your payment.</p>
      </div>
    </div>
  );
}
