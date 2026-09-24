/**
 * Payment provider contract. Today only `manual_upi` is active (customer pays the
 * displayed UPI ID and the owner verifies manually). A legitimate gateway
 * (Razorpay, Cashfree, PhonePe PG, PayU…) can be added by implementing this
 * interface and registering it — no changes to orders, UI, or DB are needed.
 */
import type { Request } from 'express';

export interface PaymentInstructions {
  provider: string;
  upiId: string;
  payeeName: string;
  upiPhone: string;
  amount: number;
  currency: string;
  upiLink: string;
  qrSvg?: string;
  instructions: string;
  supportMessage: string;
}

export interface WebhookResult {
  orderNumber: string;
  status: 'paid' | 'failed';
  providerReference: string;
  amount: number;
}

export interface PaymentProvider {
  name: string;
  /** Build what the customer sees to pay for an order (amount from server-side order) */
  instructions(order: { orderNumber: string; totalAmount: number; currency: string }): Promise<PaymentInstructions>;
  /** Verify a signed webhook from the provider. Must throw on invalid signature. */
  verifyWebhook?(req: Request): Promise<WebhookResult>;
}
