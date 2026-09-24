/** Storage that never throws (sandboxed iframes / private mode block Web Storage). */
const mem = new Map<string, string>();
function store(kind: 'local' | 'session'): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const k = '__mpr_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}
export const safeStorage = (kind: 'local' | 'session' = 'local') => ({
  get(key: string): string | null {
    const s = store(kind);
    try {
      return s ? s.getItem(key) : mem.get(`${kind}:${key}`) ?? null;
    } catch {
      return mem.get(`${kind}:${key}`) ?? null;
    }
  },
  set(key: string, value: string) {
    const s = store(kind);
    try {
      if (s) s.setItem(key, value);
      else mem.set(`${kind}:${key}`, value);
    } catch {
      mem.set(`${kind}:${key}`, value);
    }
  },
  remove(key: string) {
    const s = store(kind);
    try {
      s?.removeItem(key);
    } catch {
      /* ignore */
    }
    mem.delete(`${kind}:${key}`);
  },
});
