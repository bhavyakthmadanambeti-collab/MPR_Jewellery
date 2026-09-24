import QRCode from 'qrcode';
import { getSettings } from '../settings.service.js';
import type { PaymentProvider } from './provider.js';

/** Manual UPI: shows the owner's UPI destination. Cannot and does not verify payments automatically. */
export const manualUpiProvider: PaymentProvider = {
  name: 'manual_upi',
  async instructions(order) {
    const s = await getSettings();
    const amount = order.totalAmount.toFixed(2);
    const params = new URLSearchParams({
      pa: s.payment.upiId,
      pn: s.payment.upiDisplayName,
      am: amount,
      cu: order.currency || 'INR',
      tn: `Order ${order.orderNumber}`,
      tr: order.orderNumber,
    });
    const upiLink = `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
    const qrSvg = await QRCode.toString(upiLink, { type: 'svg', margin: 1, color: { dark: '#2B1D14', light: '#FFFDF8' } });
    return {
      provider: 'manual_upi',
      upiId: s.payment.upiId,
      payeeName: s.payment.upiDisplayName,
      upiPhone: s.payment.upiPhone,
      amount: order.totalAmount,
      currency: order.currency,
      upiLink,
      qrSvg,
      instructions: s.payment.instructions,
      supportMessage: s.payment.supportMessage,
    };
  },
};
