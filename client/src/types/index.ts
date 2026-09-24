export interface MediaImage { id: number; url: string; thumbUrl: string; width?: number; height?: number; alt: string; sortOrder: number }
export interface MediaVideo { id: number; url: string; posterUrl: string | null; mime: string; sizeBytes: number; sortOrder: number }

export interface Product {
  id: number; slug: string; sku: string; name: string; description: string;
  category: string; metalType: string; purity: string; weightGrams: number; price: number;
  stock: number; availability: 'in_stock' | 'out_of_stock' | 'made_to_order';
  isFeatured: boolean; isActive: boolean; createdAt: string; updatedAt: string;
  images: MediaImage[]; videos: MediaVideo[];
}

export interface CollectionMedia { id: number; type: 'image' | 'video'; url: string; thumbUrl: string | null; posterUrl: string | null; mime: string; width?: number; height?: number; alt: string; sortOrder: number }
export interface Collection {
  id: number; slug: string; title: string; description: string; isPublished: boolean; isVisible: boolean; showOnHome: boolean;
  sortOrder: number; publishedAt: string | null; updatedAt: string; media: CollectionMedia[]; mediaCount: number;
}

export interface Rate { key: string; label: string; group: 'gold' | 'silver' | 'diamond'; unit: string; value: number | null; source: string | null; sourceType: string | null; recordedAt: string | null }
export interface RatesResponse { rates: Rate[]; lastUpdated: string | null; mode: 'api' | 'stored'; label: string; apiConfigured: boolean }

export interface PublicSettings {
  brand: { name: string; tagline: string; logoUrl: string | null };
  contact: { phone: string; email: string; address: string; whatsapp: string; hours: string };
  payment: { upiId: string; upiDisplayName: string; upiPhone: string; instructions: string; supportMessage: string };
  commerce: { currency: string; delivery: { flatCharge: number; freeAbove: number }; tax: { mode: 'none' | 'inclusive' | 'exclusive'; ratePercent: number; label: string } };
}

export interface HomeSection { key: 'hero' | 'showcase' | 'categories' | 'featured' | 'collections' | 'craft'; enabled: boolean }

export interface OrderItem { id: number; productId: number | null; productName: string; sku: string; purity: string; weightGrams: number; unitPrice: number; quantity: number; lineTotal: number; thumbUrl: string | null; productSlug: string | null }
export interface Payment { id: number; amount: number; method: string; provider: string; status: string; customerReference: string | null; customerConfirmedAt: string | null; verifiedAt: string | null; verifiedBy: string | null; ownerNote: string | null }
export interface Order {
  id: number; orderNumber: string; customerId: number | null; customerName: string; phone: string; email: string;
  address: string; city: string; state: string; pincode: string; currency: string;
  subtotal: number; deliveryCharge: number; taxAmount: number; taxMode: string; totalAmount: number;
  paymentMethod: string; paymentStatus: string; orderStatus: string; createdAt: string; updatedAt: string;
  items: OrderItem[]; payment: Payment | null; itemSummary?: string; itemCount?: number;
}
export interface PaymentInstructions { provider: string; upiId: string; payeeName: string; upiPhone: string; amount: number; currency: string; upiLink: string; qrSvg?: string; instructions: string; supportMessage: string }
export interface OrderDetailResponse { order: Order; accessToken: string; paymentInstructions: PaymentInstructions | null; history: { event: string; to_status: string; actor_type: string; created_at: string }[]; message?: string }

export interface Quote {
  currency: string;
  items: { productId: number; slug: string; name: string; sku: string; purity: string; weightGrams: number; availability: string; stock: number; thumbUrl: string | null; unitPrice: number; quantity: number; lineTotal: number }[];
  subtotal: number; delivery: number; freeDeliveryAbove: number; tax: { mode: string; ratePercent: number; label: string; amount: number }; total: number;
}
