import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!path) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const r = await api<T>(path, { signal: c.signal });
      if (!c.signal.aborted) setData(r);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e.message || 'Something went wrong.');
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load]);

  return { data, setData, error, loading, reload: load };
}
