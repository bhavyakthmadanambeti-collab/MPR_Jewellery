import { STATIC_MODE, staticApi } from './staticApi';
/**
 * API client. `__PORT_5000__` is rewritten by the preview host to the proxied backend
 * URL; in normal deployments set VITE_API_URL (or leave empty for same-origin /api).
 */
const PREVIEW_BASE = '__PORT_5000__';
export const API_BASE: string = PREVIEW_BASE.startsWith('__') ? (import.meta.env.VITE_API_URL as string) || '' : PREVIEW_BASE;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type TokenGetter = () => string | null;
let ownerToken: TokenGetter = () => null;
let customerToken: TokenGetter = () => null;
let onOwnerUnauthorized: () => void = () => {};
export function configureAuth(o: { owner: TokenGetter; customer: TokenGetter; onOwnerUnauthorized: () => void }) {
  ownerToken = o.owner;
  customerToken = o.customer;
  onOwnerUnauthorized = o.onOwnerUnauthorized;
}

function authHeader(path: string): Record<string, string> {
  const isOwner = path.startsWith('/api/owner') && path !== '/api/owner/login';
  const t = isOwner ? ownerToken() : customerToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const FRIENDLY_NETWORK = 'We could not reach the server. Please check your connection and try again.';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (STATIC_MODE) {
    try {
      return (await staticApi(path, opts.method || (opts.body ? 'POST' : 'GET'), opts.body)) as T;
    } catch (e: any) {
      throw new ApiError(e?.status || 503, e?.message || FRIENDLY_NETWORK);
    }
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...authHeader(path) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, FRIENDLY_NETWORK);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/api/owner') && path !== '/api/owner/login') onOwnerUnauthorized();
    throw new ApiError(res.status, data?.error || 'Something went wrong. Please try again.');
  }
  return data as T;
}

/** Multipart upload with progress (XHR — fetch has no upload progress events). */
export function upload<T = any>(path: string, form: FormData, onProgress?: (pct: number) => void, method = 'POST'): Promise<T> {
  if (STATIC_MODE) return Promise.reject(new ApiError(503, 'Uploads need the MPR JEWELLERY server, which is not connected to this website yet.'));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${path}`);
    const h = authHeader(path);
    Object.entries(h).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else {
        if (xhr.status === 401) onOwnerUnauthorized();
        reject(new ApiError(xhr.status, data?.error || 'Upload failed. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Please check your connection and try again.'));
    xhr.send(form);
  });
}

export function mediaUrl(u?: string | null): string {
  if (!u) return '';
  if (/^(https?:|data:|blob:)/.test(u)) return u;
  return `${API_BASE}${u}`;
}
