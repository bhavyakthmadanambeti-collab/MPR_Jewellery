import type { PaymentProvider } from './provider.js';
import { manualUpiProvider } from './manual-upi.provider.js';

const providers: Record<string, PaymentProvider> = {
  manual_upi: manualUpiProvider,
  // razorpay: razorpayProvider,   ← register a gateway here later (see README → "Automatic payment verification")
};

export const ACTIVE_PROVIDER = process.env.PAYMENT_PROVIDER || 'manual_upi';

export function getProvider(name = ACTIVE_PROVIDER): PaymentProvider {
  return providers[name] || manualUpiProvider;
}

export function getWebhookProvider(name: string): PaymentProvider | null {
  const p = providers[name];
  return p && p.verifyWebhook ? p : null;
}
