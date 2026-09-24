import { db } from '../database/db.js';
import { env } from '../config/env.js';
import { RATE_KEYS } from '../models/mappers.js';
import { badRequest } from '../utils/http.js';

export const RATE_META: Record<(typeof RATE_KEYS)[number], { label: string; group: 'gold' | 'silver' | 'diamond'; unit: string }> = {
  gold_24k: { label: 'Gold 24K', group: 'gold', unit: 'gram' },
  gold_22k: { label: 'Gold 22K', group: 'gold', unit: 'gram' },
  gold_916: { label: 'Gold 916', group: 'gold', unit: 'gram' },
  gold_18k: { label: 'Gold 18K', group: 'gold', unit: 'gram' },
  silver: { label: 'Silver', group: 'silver', unit: 'gram' },
  diamond: { label: 'Diamond', group: 'diamond', unit: 'carat' },
};

/** Current rate = latest stored row per metal. Never fabricated. */
export async function currentRates() {
  const rows = await db.query(
    `SELECT DISTINCT ON (metal_key) metal_key, value, unit, source, source_type, recorded_at
       FROM metal_rates ORDER BY metal_key, recorded_at DESC, id DESC`
  );
  const rates = RATE_KEYS.map((k) => {
    const r = rows.find((x) => x.metal_key === k);
    return {
      key: k,
      ...RATE_META[k],
      value: r ? Number(r.value) : null,
      source: r?.source ?? null,
      sourceType: r?.source_type ?? null,
      recordedAt: r?.recorded_at ?? null,
    };
  });
  const latest = rows.reduce<string | null>((m, r) => (!m || new Date(r.recorded_at) > new Date(m) ? r.recorded_at : m), null);
  const anyApi = rows.some((r) => r.source_type === 'api');
  return {
    rates,
    lastUpdated: latest,
    mode: anyApi ? 'api' : 'stored',
    label: anyApi ? 'Rates fetched from connected rate provider' : 'Owner-approved stored rates',
    apiConfigured: !!env.ratesApiUrl,
  };
}

export async function updateRates(values: Partial<Record<(typeof RATE_KEYS)[number], number>>, source: string, ownerId: number) {
  const entries = Object.entries(values).filter(([k, v]) => RATE_KEYS.includes(k as any) && typeof v === 'number' && v >= 0);
  if (!entries.length) throw badRequest('Enter at least one rate.');
  await db.transaction(async (tx) => {
    for (const [k, v] of entries) {
      await tx.query(`INSERT INTO metal_rates (metal_key, value, unit, source, source_type, created_by) VALUES ($1,$2,$3,$4,'owner',$5)`, [
        k, v, RATE_META[k as keyof typeof RATE_META].unit, source || 'Owner (manual entry)', ownerId,
      ]);
    }
  });
  return currentRates();
}

export async function rateHistory(limit = 60) {
  return db.query(
    `SELECT r.metal_key, r.value, r.unit, r.source, r.source_type, r.recorded_at, o.email AS owner_email
       FROM metal_rates r LEFT JOIN owners o ON o.id = r.created_by ORDER BY r.recorded_at DESC, r.id DESC LIMIT $1`,
    [limit]
  );
}

/**
 * Optional live rate provider. Configure RATES_API_URL (+ RATES_API_KEY) to an endpoint
 * that returns JSON like { "gold_24k": 15273, "gold_22k": 14000, "gold_18k": 11770, "silver": 250, "source": "Provider name" }.
 * On failure the stored owner-approved rates remain in effect.
 */
export async function fetchLiveRates(ownerId: number | null) {
  if (!env.ratesApiUrl) throw badRequest('No live rate API is configured. Rates are managed manually by the owner.');
  let data: any;
  try {
    const res = await fetch(env.ratesApiUrl, { headers: env.ratesApiKey ? { Authorization: `Bearer ${env.ratesApiKey}` } : {}, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e: any) {
    throw badRequest(`Live rate provider is unavailable (${e.message}). The stored owner-approved rates are still shown.`);
  }
  const source = String(data.source || new URL(env.ratesApiUrl).hostname);
  const entries = RATE_KEYS.map((k) => [k, Number(data[k])] as const).filter(([, v]) => Number.isFinite(v) && v > 0);
  if (!entries.length) throw badRequest('Live rate provider returned no usable values.');
  await db.transaction(async (tx) => {
    for (const [k, v] of entries) {
      await tx.query(`INSERT INTO metal_rates (metal_key, value, unit, source, source_type, created_by) VALUES ($1,$2,$3,$4,'api',$5)`, [k, v, RATE_META[k].unit, source, ownerId]);
    }
  });
  return currentRates();
}
