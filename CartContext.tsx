import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { safeStorage } from '@/utils/safeStorage';

/** The cart only stores product IDs + quantities. Prices are always fetched from the server. */
export interface CartLine { productId: number; quantity: number; name?: string; slug?: string }
interface CartState {
  lines: CartLine[];
  count: number;
  add: (l: CartLine) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}
const Ctx = createContext<CartState>(null as any);
const store = safeStorage('local');
const KEY = 'mpr_cart_v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = store.get(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((l) => Number.isInteger(l.productId) && l.quantity > 0) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => store.set(KEY, JSON.stringify(lines)), [lines]);
  const value = useMemo<CartState>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      add: (l) =>
        setLines((cur) => {
          const ex = cur.find((c) => c.productId === l.productId);
          if (ex) return cur.map((c) => (c.productId === l.productId ? { ...c, quantity: Math.min(20, c.quantity + l.quantity) } : c));
          return [...cur, l];
        }),
      setQty: (id, q) => setLines((cur) => cur.map((c) => (c.productId === id ? { ...c, quantity: Math.max(1, Math.min(20, q)) } : c))),
      remove: (id) => setLines((cur) => cur.filter((c) => c.productId !== id)),
      clear: () => setLines([]),
    }),
    [lines]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useCart = () => useContext(Ctx);
