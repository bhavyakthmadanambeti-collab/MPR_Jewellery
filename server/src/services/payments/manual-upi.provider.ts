import QRCode from 'qrcode';
import { getSettings } from '../settings.service.js';
import type { PaymentProvider } from './provider.js';

/** Percent-encode a UPI value but keep "@" literal (some UPI apps and QR readers do not decode %40). */
const enc = (v: string) => encodeURIComponent(v).replace(/%40/g, '@');

/**
 * Build an NPCI-style UPI deep link.
 * - Personal UPI ID (no merchant code): only pa, pn, am, cu, tn. Sending merchant-only fields
 *   (tr) to a personal ID makes Google Pay show "bank limit exceeded" and PhonePe block the payment.
 * - Merchant UPI ID: adds mc and a tr that is unique for every payment attempt (never reused on retry).
 */
export function buildUpiLink(o: { upiId: string; payeeName: string; amount: number; orderNumber: string; merchantCode?: string; currency?: string }) {
  const parts = [
    `pa=${enc(o.upiId.trim())}`,
    `pn=${enc(o.payeeName.trim().slice(0, 50))}`,
    `am=${o.amount.toFixed(2)}`,
    `cu=${o.currency || 'INR'}`,
    `tn=${enc(`Order ${o.orderNumber}`.slice(0, 50))}`,
  ];
  if (o.merchantCode) {
    const attempt = Date.now().toString(36).toUpperCase();
    const tr = `${o.orderNumber}${attempt}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 35);
    parts.push(`mc=${o.merchantCode}`, `tr=${tr}`);
  }
  return `upi://pay?${parts.join('&')}`;
}

/** Manual UPI: shows the owner's UPI destination. Cannot and does not verify payments automatically. */
export const manualUpiProvider: PaymentProvider = {
  name: 'manual_upi',
  async instructions(order) {
    const s = await getSettings();
    const merchantCode = (s.payment.merchantCode || '').trim();
    const upiMaxAmount = Number(s.payment.upiMaxAmount) || 100000;
    const upiAllowed = order.totalAmount > 0 && order.totalAmount <= upiMaxAmount;
    const upiLink = buildUpiLink({
      upiId: s.payment.upiId,
      payeeName: s.payment.upiDisplayName,
      amount: order.totalAmount,
      orderNumber: order.orderNumber,
      merchantCode,
      currency: order.currency,
    });
    const qrSvg = upiAllowed
      ? await QRCode.toString(upiLink, { type: 'svg', margin: 1, color: { dark: '#2B1D14', light: '#FFFDF8' } })
      : undefined;
    return {
      provider: 'manual_upi',
      upiId: s.payment.upiId,
      payeeName: s.payment.upiDisplayName,
      upiPhone: s.payment.upiPhone,
      amount: order.totalAmount,
      currency: order.currency,
      upiLink,
      upiAllowed,
      upiMaxAmount,
      qrSvg,
      instructions: s.payment.instructions,
      supportMessage: s.payment.supportMessage,
    };
  },
};
