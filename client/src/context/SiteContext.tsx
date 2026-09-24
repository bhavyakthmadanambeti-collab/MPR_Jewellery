import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/services/api';
import type { PublicSettings, RatesResponse } from '@/types';

interface SiteState { settings: PublicSettings | null; rates: RatesResponse | null; refresh: () => void }
const Ctx = createContext<SiteState>({ settings: null, rates: null, refresh: () => {} });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [rates, setRates] = useState<RatesResponse | null>(null);
  const refresh = useCallback(() => {
    api<PublicSettings>('/api/settings').then(setSettings).catch(() => {});
    api<RatesResponse>('/api/rates').then(setRates).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(() => api<RatesResponse>('/api/rates').then(setRates).catch(() => {}), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [refresh]);
  return <Ctx.Provider value={{ settings, rates, refresh }}>{children}</Ctx.Provider>;
}
export const useSite = () => useContext(Ctx);
