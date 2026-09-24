import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  // schema.sql lives next to this file in src/, and is copied to dist/ on build
  const candidates = [path.join(__dirname, 'schema.sql'), path.join(__dirname, '../../src/database/schema.sql')];
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error('schema.sql not found');
  await db.exec(fs.readFileSync(file, 'utf8'));
}
