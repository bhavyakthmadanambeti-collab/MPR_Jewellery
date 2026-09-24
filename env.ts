import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../../..');

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing required environment variable ${name}`);
  return v;
}

const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd && process.env.ALLOW_EPHEMERAL_JWT !== 'true') {
    throw new Error('JWT_SECRET must be set in production');
  }
  // Development only: random per-process secret (tokens reset on restart)
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('[config] JWT_SECRET not set — using an ephemeral development secret.');
}

export const env = {
  isProd,
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL || '',
  // Embedded PostgreSQL (PGlite) data dir used when DATABASE_URL is not configured
  pgliteDir: process.env.PGLITE_DIR || path.join(ROOT_DIR, 'storage', 'pgdata'),
  jwtSecret,
  jwtOwnerExpiry: process.env.JWT_OWNER_EXPIRY || '8h',
  jwtCustomerExpiry: process.env.JWT_CUSTOMER_EXPIRY || '7d',
  storageDriver: (process.env.STORAGE_DRIVER || (process.env.SUPABASE_URL ? 'supabase' : 'local')) as 'local' | 'supabase',
  localStorageDir: process.env.LOCAL_STORAGE_DIR || path.join(ROOT_DIR, 'storage', 'uploads'),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseBucket: process.env.SUPABASE_BUCKET || 'mpr-media',
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  clientDist: process.env.CLIENT_DIST || path.join(ROOT_DIR, 'client', 'dist'),
  seedOwnerEmail: process.env.SEED_OWNER_EMAIL || '',
  seedOwnerPassword: process.env.SEED_OWNER_PASSWORD || '',
  upiId: process.env.UPI_ID || '9030957387@axl',
  upiPhone: process.env.UPI_PHONE || '9030957387',
  ratesApiUrl: process.env.RATES_API_URL || '',
  ratesApiKey: process.env.RATES_API_KEY || '',
  maxImageMb: Number(process.env.MAX_IMAGE_MB || 15),
  maxVideoMb: Number(process.env.MAX_VIDEO_MB || 200),
  required,
};
