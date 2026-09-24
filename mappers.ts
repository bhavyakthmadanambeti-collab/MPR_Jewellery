import { mediaUrl } from '../services/storage.service.js';
import { num } from '../utils/money.js';

export const CATEGORIES = ['gold', 'silver', 'diamond', 'rings', 'necklaces', 'earrings', 'bangles', 'bracelets', 'chains', 'other'] as const;
export const METALS = ['gold', 'silver', 'diamond', 'platinum', 'other'] as const;
export const AVAILABILITY = ['in_stock', 'out_of_stock', 'made_to_order'] as const;
export const PAYMENT_STATUSES = ['awaiting_payment', 'pending_verification', 'paid', 'failed', 'cancelled'] as const;
export const ORDER_STATUSES = ['placed', 'processing', 'ready', 'dispatched', 'delivered', 'cancelled'] as const;
export const RATE_KEYS = ['gold_24k', 'gold_22k', 'gold_916', 'gold_18k', 'silver', 'diamond'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const mapImage = (r: any) => ({
  id: r.id,
  url: mediaUrl(r.storage_path, r.storage_driver),
  thumbUrl: mediaUrl(r.thumb_path || r.storage_path, r.storage_driver),
  width: r.width,
  height: r.height,
  alt: r.alt,
  sortOrder: r.sort_order,
});

export const mapVideo = (r: any) => ({
  id: r.id,
  url: mediaUrl(r.storage_path, r.storage_driver),
  posterUrl: mediaUrl(r.poster_path, r.storage_driver),
  mime: r.mime,
  sizeBytes: num(r.size_bytes),
  sortOrder: r.sort_order,
});

export const mapProduct = (r: any, images: any[] = [], videos: any[] = []) => ({
  id: r.id,
  slug: r.slug,
  sku: r.sku,
  name: r.name,
  description: r.description,
  category: r.category,
  metalType: r.metal_type,
  purity: r.purity,
  weightGrams: num(r.weight_grams),
  price: num(r.price),
  stock: r.stock,
  availability: r.availability,
  isFeatured: r.is_featured,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  images: images.map(mapImage),
  videos: videos.map(mapVideo),
});

export const mapCollectionMedia = (r: any) => ({
  id: r.id,
  type: r.media_type as 'image' | 'video',
  url: mediaUrl(r.storage_path, r.storage_driver),
  thumbUrl: mediaUrl(r.thumb_path || (r.media_type === 'image' ? r.storage_path : r.poster_path), r.storage_driver),
  posterUrl: mediaUrl(r.poster_path, r.storage_driver),
  mime: r.mime,
  width: r.width,
  height: r.height,
  alt: r.alt,
  sortOrder: r.sort_order,
});

export const mapCollection = (r: any, media: any[] = []) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description,
  isPublished: r.is_published,
  isVisible: r.is_visible,
  showOnHome: r.show_on_home,
  sortOrder: r.sort_order,
  publishedAt: r.published_at,
  updatedAt: r.updated_at,
  media: media.map(mapCollectionMedia),
  mediaCount: r.media_count !== undefined ? num(r.media_count) : media.length,
});

export const mapOrderItem = (r: any) => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name,
  sku: r.sku,
  purity: r.purity,
  weightGrams: num(r.weight_grams),
  unitPrice: num(r.unit_price),
  quantity: r.quantity,
  lineTotal: num(r.line_total),
  thumbUrl: r.thumb_path ? mediaUrl(r.thumb_path, r.storage_driver) : null,
  productSlug: r.product_slug ?? null,
});

export const mapPayment = (r: any) => ({
  id: r.id,
  amount: num(r.amount),
  method: r.method,
  provider: r.provider,
  status: r.status,
  customerReference: r.customer_reference,
  customerConfirmedAt: r.customer_confirmed_at,
  verifiedAt: r.verified_at,
  verifiedBy: r.verified_by_email ?? r.verified_by ?? null,
  ownerNote: r.owner_note,
  createdAt: r.created_at,
});

export const mapOrder = (r: any, items: any[] = [], payment?: any) => ({
  id: r.id,
  orderNumber: r.order_number,
  customerId: r.customer_id,
  customerName: r.customer_name,
  phone: r.phone,
  email: r.email,
  address: r.address,
  city: r.city,
  state: r.state,
  pincode: r.pincode,
  currency: r.currency,
  subtotal: num(r.subtotal),
  deliveryCharge: num(r.delivery_charge),
  taxAmount: num(r.tax_amount),
  taxMode: r.tax_mode,
  totalAmount: num(r.total_amount),
  paymentMethod: r.payment_method,
  paymentStatus: r.payment_status as PaymentStatus,
  orderStatus: r.order_status as OrderStatus,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  items: items.map(mapOrderItem),
  payment: payment ? mapPayment(payment) : null,
  itemSummary: r.item_summary ?? undefined,
  itemCount: r.item_count !== undefined ? num(r.item_count) : undefined,
});
