/**
 * Database adapter.
 *  - If DATABASE_URL is set → connects to PostgreSQL / Supabase Postgres via `pg`.
 *  - Otherwise → uses PGlite (real PostgreSQL compiled to WASM) persisted on disk,
 *    so the app runs locally with zero setup using the exact same SQL.
 */
import fs from 'node:fs';
import { env } from '../config/env.js';

export type Row = Record<string, any>;
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

interface Driver extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  kind: 'pg' | 'pglite';
}

let driver: Driver | null = null;

async function createPg(): Promise<Driver> {
  const { default: pg } = await import('pg');
  // Return NUMERIC as JS numbers are handled in mappers; keep int8 counts as numbers
  pg.types.setTypeParser(20, (v: string) => Number(v));
  const pool = new pg.Pool({
    connectionString: env.databaseUrl,
    ssl: /supabase|sslmode=require/.test(env.databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
  return {
    kind: 'pg',
    async query(sql, params = []) {
      const r = await pool.query(sql, params as any[]);
      return r.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: async (s, p = []) => (await client.query(s, p as any[])).rows });
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function createPglite(): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite');
  fs.mkdirSync(env.pgliteDir, { recursive: true });
  const db = new PGlite(env.pgliteDir);
  await db.waitReady;
  const q = async (sql: string, params: unknown[] = []) => {
    const r = await db.query(sql, params as any[]);
    return r.rows as any[];
  };
  return {
    kind: 'pglite',
    query: q,
    async exec(sql) {
      await db.exec(sql);
    },
    async transaction(fn) {
      return db.transaction(async (tx) =>
        fn({ query: async (s, p = []) => (await tx.query(s, p as any[])).rows as any[] })
      ) as any;
    },
  };
}

export async function initDb(): Promise<Driver> {
  if (driver) return driver;
  driver = env.databaseUrl ? await createPg() : await createPglite();
  console.log(`[db] connected using ${driver.kind === 'pg' ? 'PostgreSQL (DATABASE_URL)' : 'embedded PostgreSQL (PGlite)'}`);
  return driver;
}

function d(): Driver {
  if (!driver) throw new Error('Database not initialised');
  return driver;
}

export const db = {
  query: <T = Row>(sql: string, params?: unknown[]) => d().query<T>(sql, params),
  one: async <T = Row>(sql: string, params?: unknown[]): Promise<T | undefined> => (await d().query<T>(sql, params))[0],
  exec: (sql: string) => d().exec(sql),
  transaction: <T>(fn: (tx: Queryable) => Promise<T>) => d().transaction(fn),
};
