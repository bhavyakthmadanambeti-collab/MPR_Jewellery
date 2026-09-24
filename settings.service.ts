import { db } from '../database/db.js';
import { env } from '../config/env.js';

export type HomeSectionKey = 'hero' | 'showcase' | 'categories' | 'featured' | 'collections' | 'craft';

export interface SiteSettings {
  brand: { name: string; tagline: string; logoPath: string | null };
  contact: { phone: string; email: string; address: string; whatsapp: string; hours: string };
  payment: {
    upiId: string;
    upiDisplayName: string;
    upiPhone: string;
    instructions: string;
    supportMessage: string;
  };
  commerce: {
    currency: string;
    delivery: { flatCharge: number; freeAbove: number };
    tax: { mode: 'none' | 'inclusive' | 'exclusive'; ratePercent: number; label: string };
  };
  home: {
    heroCollectionId: number | null;
    heroEyebrow: string;
    heroSubtitle: string;
    sections: { key: HomeSectionKey; enabled: boolean }[];
  };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: { name: 'MPR JEWELLERY', tagline: 'Fine gold, silver & diamond jewellery', logoPath: null },
  contact: {
    phone: env.upiPhone,
    email: 'bhavyakthmadanambeti@gmail.com',
    address: 'Chengalpattu, Tamil Nadu, India',
    whatsapp: env.upiPhone,
    hours: 'Mon–Sat, 10:00 AM – 8:30 PM',
  },
  payment: {
    upiId: env.upiId,
    upiDisplayName: 'MPR JEWELLERY',
    upiPhone: env.upiPhone,
    instructions:
      'Pay the exact order amount to the UPI ID above using any UPI app. After paying, tap "I have made the payment". Keep your UPI transaction reference (UTR) for your records.',
    supportMessage: 'Need help with payment? Call or WhatsApp us and quote your Order ID.',
  },
  commerce: {
    currency: 'INR',
    delivery: { flatCharge: 250, freeAbove: 25000 },
    tax: { mode: 'inclusive', ratePercent: 3, label: 'GST' },
  },
  home: {
    heroCollectionId: null,
    heroEyebrow: 'MPR JEWELLERY',
    heroSubtitle: 'Hallmarked gold, sterling silver and certified diamonds — crafted for every occasion.',
    sections: [
      { key: 'hero', enabled: true },
      { key: 'categories', enabled: true },
      { key: 'showcase', enabled: true },
      { key: 'featured', enabled: true },
      { key: 'collections', enabled: true },
      { key: 'craft', enabled: true },
    ],
  },
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[];

function deepMerge<T>(base: T, patch: any): T {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return (patch ?? base) as T;
  const out: any = { ...base };
  for (const k of Object.keys(patch || {})) {
    const bv = (base as any)[k];
    const pv = patch[k];
    out[k] = bv && typeof bv === 'object' && !Array.isArray(bv) && pv && typeof pv === 'object' && !Array.isArray(pv)
      ? deepMerge(bv, pv)
      : pv;
  }
  return out;
}

export async function getSettings(): Promise<SiteSettings> {
  const rows = await db.query<{ key: string; value: any }>('SELECT key, value FROM site_settings');
  let s: SiteSettings = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) {
    if (KEYS.includes(r.key as keyof SiteSettings)) {
      const val = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
      (s as any)[r.key] = deepMerge((DEFAULT_SETTINGS as any)[r.key], val);
    }
  }
  return s;
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings();
  for (const key of KEYS) {
    if (patch[key] === undefined) continue;
    const merged = deepMerge(current[key], patch[key]);
    await db.query(
      `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(merged)]
    );
  }
  return getSettings();
}
