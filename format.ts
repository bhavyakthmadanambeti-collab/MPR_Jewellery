const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatINR = (n: number | null | undefined, decimals = false) => (n === null || n === undefined ? '—' : (decimals || n % 1 !== 0 ? inr2 : inr).format(n));

export const formatDate = (d?: string | null, withTime = true) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}), timeZone: 'Asia/Kolkata' }) : '—';

export const timeAgo = (d?: string | null) => {
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return formatDate(d, false);
};

export const CATEGORY_LABELS: Record<string, string> = {
  gold: 'Gold', silver: 'Silver', diamond: 'Diamond', rings: 'Rings', necklaces: 'Necklaces', earrings: 'Earrings',
  bangles: 'Bangles', bracelets: 'Bracelets', chains: 'Chains', other: 'Other',
};
export const METAL_LABELS: Record<string, string> = { gold: 'Gold', silver: 'Silver', diamond: 'Diamond', platinum: 'Platinum', other: 'Other' };
export const AVAILABILITY_LABELS: Record<string, string> = { in_stock: 'In stock', out_of_stock: 'Currently unavailable', made_to_order: 'Made to order' };

/** Customer-facing payment status wording */
export const PAYMENT_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting Payment',
  pending_verification: 'Pending Verification',
  paid: 'Payment Verified',
  failed: 'Payment Failed',
  cancelled: 'Order Cancelled',
};
/** Owner-facing payment status wording */
export const OWNER_PAYMENT_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting Payment',
  pending_verification: 'Pending Verification',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
export const ORDER_LABELS: Record<string, string> = {
  placed: 'Order Placed', processing: 'Order Processing', ready: 'Ready', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
};

export const cls = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
