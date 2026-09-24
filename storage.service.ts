/**
 * Object storage abstraction.
 *  - `local`    → files written under storage/uploads and streamed by /api/media/*
 *  - `supabase` → Supabase Storage bucket (public read, service-role write from server only)
 * The database only stores the object key + metadata, never the binary.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { badRequest } from '../utils/http.js';

export const IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];

interface StorageDriver {
  name: 'local' | 'supabase';
  put(key: string, data: Buffer | string, contentType: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
  url(key: string): string;
}

const localDriver: StorageDriver = {
  name: 'local',
  async put(key, data, _ct) {
    const full = safeLocalPath(key);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    if (typeof data === 'string') await fsp.copyFile(data, full);
    else await fsp.writeFile(full, data);
  },
  async remove(keys) {
    await Promise.all(keys.filter(Boolean).map((k) => fsp.rm(safeLocalPath(k), { force: true })));
  },
  url(key) {
    return `/api/media/${key}`;
  },
};

export function safeLocalPath(key: string) {
  const base = path.resolve(env.localStorageDir);
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw badRequest('Invalid storage key');
  return full;
}

let supabaseDriver: StorageDriver | null = null;
async function getSupabaseDriver(): Promise<StorageDriver> {
  if (supabaseDriver) return supabaseDriver;
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
  const bucket = env.supabaseBucket;
  supabaseDriver = {
    name: 'supabase',
    async put(key, data, contentType) {
      const body = typeof data === 'string' ? await fsp.readFile(data) : data;
      const { error } = await client.storage.from(bucket).upload(key, body, { contentType, upsert: true, cacheControl: '31536000' });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    },
    async remove(keys) {
      const k = keys.filter(Boolean);
      if (k.length) await client.storage.from(bucket).remove(k);
    },
    url(key) {
      return client.storage.from(bucket).getPublicUrl(key).data.publicUrl;
    },
  };
  return supabaseDriver;
}

async function driver(): Promise<StorageDriver> {
  return env.storageDriver === 'supabase' ? getSupabaseDriver() : localDriver;
}

export async function driverName() {
  return (await driver()).name;
}

export function mediaUrl(key: string | null | undefined, driverName = 'local'): string | null {
  if (!key) return null;
  if (driverName === 'supabase' && supabaseDriver) return supabaseDriver.url(key);
  if (driverName === 'supabase') return `${env.supabaseUrl}/storage/v1/object/public/${env.supabaseBucket}/${key}`;
  return localDriver.url(key);
}

export interface StoredImage {
  storagePath: string;
  thumbPath: string;
  storageId: string;
  driver: string;
  mime: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/** Validates, compresses (WebP) and stores an image + thumbnail. */
export async function storeImage(buffer: Buffer, folder: string): Promise<StoredImage> {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw badRequest('Image upload failed. The file does not look like a valid image.');
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
    throw badRequest('Only JPG, JPEG, PNG and WEBP images are supported.');
  }
  const id = crypto.randomUUID();
  const full = await sharp(buffer).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const thumb = await sharp(buffer).rotate().resize({ width: 560, height: 560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  const d = await driver();
  const storagePath = `${folder}/${id}.webp`;
  const thumbPath = `${folder}/${id}_thumb.webp`;
  await d.put(storagePath, full.data, 'image/webp');
  await d.put(thumbPath, thumb, 'image/webp');
  return {
    storagePath,
    thumbPath,
    storageId: id,
    driver: d.name,
    mime: 'image/webp',
    width: full.info.width,
    height: full.info.height,
    sizeBytes: full.data.length,
  };
}

export interface StoredVideo {
  storagePath: string;
  posterPath: string | null;
  storageId: string;
  driver: string;
  mime: string;
  sizeBytes: number;
}

const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

async function sniffVideo(filePath: string): Promise<boolean> {
  const fh = await fsp.open(filePath, 'r');
  const buf = Buffer.alloc(16);
  await fh.read(buf, 0, 16, 0);
  await fh.close();
  const isMp4OrMov = buf.subarray(4, 8).toString('ascii') === 'ftyp' || ['moov', 'mdat', 'wide', 'free'].includes(buf.subarray(4, 8).toString('ascii'));
  const isWebm = buf.readUInt32BE(0) === 0x1a45dfa3;
  return isMp4OrMov || isWebm;
}

function extractPoster(videoPath: string, outPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.5', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=1280:-2', outPath]);
      p.on('error', () => resolve(false));
      p.on('close', (code) => resolve(code === 0 && fs.existsSync(outPath)));
    } catch {
      resolve(false);
    }
  });
}

/** Stores a video from a temp file. Generates a poster frame when ffmpeg is available. */
export async function storeVideo(tempPath: string, mime: string, folder: string): Promise<StoredVideo> {
  const normalized = mime === 'video/mov' ? 'video/quicktime' : mime;
  if (!VIDEO_MIME.includes(normalized)) throw badRequest('Only MP4, WEBM and MOV videos are supported.');
  if (!(await sniffVideo(tempPath))) throw badRequest('Video upload failed. The file does not look like a valid video.');
  const id = crypto.randomUUID();
  const d = await driver();
  const storagePath = `${folder}/${id}.${VIDEO_EXT[normalized]}`;
  const stat = await fsp.stat(tempPath);
  await d.put(storagePath, tempPath, normalized);

  let posterPath: string | null = null;
  const posterTmp = path.join(os.tmpdir(), `${id}_poster.jpg`);
  if (await extractPoster(tempPath, posterTmp)) {
    const poster = await sharp(posterTmp).webp({ quality: 78 }).toBuffer();
    posterPath = `${folder}/${id}_poster.webp`;
    await d.put(posterPath, poster, 'image/webp');
    await fsp.rm(posterTmp, { force: true });
  }
  await fsp.rm(tempPath, { force: true });
  return { storagePath, posterPath, storageId: id, driver: d.name, mime: normalized, sizeBytes: stat.size };
}

export async function storePosterImage(buffer: Buffer, folder: string): Promise<string> {
  const img = await storeImage(buffer, folder);
  await removeObjects([img.thumbPath]);
  return img.storagePath;
}

export async function removeObjects(keys: (string | null | undefined)[]) {
  const d = await driver();
  await d.remove(keys.filter((k): k is string => !!k));
}
