```ts
import QRCode from 'qrcode';
import { getSettings } from '../settings.service.js';
import type { PaymentProvider } from './provider.js';

interface BuildUpiLinkOptions {
  upiId: string;
  payeeName: string;
  amount: number;
  orderNumber: string;
  merchantCode?: string;
  currency?: string;
}

/**
 * Creates a standard UPI payment link.
 * Optional merchant-code and transaction-reference parameters
 * are intentionally omitted for this diagnostic version.
 */
export function buildUpiLink(o: BuildUpiLinkOptions): string {
  const upiId = o.upiId.trim();
  const payeeName = o.payeeName.trim();
  const currency = (o.currency || 'INR').trim().toUpperCase();

  if (!upiId || !upiId.includes('@')) {
    throw new Error(
      'Please configure a valid receiving UPI ID in Owner Portal settings.'
    );
  }

  if (!Number.isFinite(o.amount) || o.amount <= 0) {
    throw new Error('Invalid payment amount.');
  }

  if (currency !== 'INR') {
    throw new Error('UPI payments must use INR.');
  }

  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName.slice(0, 50),
    am: o.amount.toFixed(2),
    cu: currency,
    tn: `Order ${o.orderNumber}`.slice(0, 50),
  });

  return `upi://pay?${params.toString()}`;
}

export const manualUpiProvider: PaymentProvider = {
  name: 'manual_upi',

  async instructions(order) {
    const settings = await getSettings();

    const upiId = (settings.payment.upiId || '').trim();
    const payeeName =
      (settings.payment.upiDisplayName || 'MPR JEWELLERY').trim();
    const merchantCode = (settings.payment.merchantCode || '').trim();

    const configuredMaxAmount = Number(settings.payment.upiMaxAmount);
    const upiMaxAmount =
      Number.isFinite(configuredMaxAmount) && configuredMaxAmount > 0
        ? configuredMaxAmount
        : 100000;

    const upiAllowed =
      Number.isFinite(order.totalAmount) &&
      order.totalAmount > 0 &&
      order.totalAmount <= upiMaxAmount &&
      Boolean(upiId) &&
      upiId.includes('@');

    let upiLink: string | undefined;
    let qrSvg: string | undefined;

    if (upiAllowed) {
      upiLink = buildUpiLink({
        upiId,
        payeeName,
        amount: order.totalAmount,
        orderNumber: order.orderNumber,
        merchantCode,
        currency: order.currency,
      });

      qrSvg = await QRCode.toString(upiLink, {
        type: 'svg',
        margin: 1,
        color: {
          dark: '#2B1D14',
          light: '#FFFDF8',
        },
      });
    }

    return {
      provider: 'manual_upi',
      upiId,
      payeeName,
      upiPhone: settings.payment.upiPhone,
      amount: order.totalAmount,
      currency: order.currency,
      upiLink,
      upiAllowed,
      upiMaxAmount,
      qrSvg,
      instructions: settings.payment.instructions,
      supportMessage: settings.payment.supportMessage,
    };
  },
};
```
