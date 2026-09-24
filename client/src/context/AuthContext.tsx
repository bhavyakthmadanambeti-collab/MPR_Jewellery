import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, configureAuth } from '@/services/api';
import { safeStorage } from '@/utils/safeStorage';

interface Owner { id: number; email: string; name: string; role: string }
interface Customer { id: number; name: string; email: string; phone: string }

interface AuthState {
  owner: Owner | null;
  ownerReady: boolean;
  ownerLogin: (email: string, password: string) => Promise<void>;
  ownerLogout: () => void;
  customer: Customer | null;
  customerLogin: (email: string, password: string) => Promise<void>;
  customerRegister: (d: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  customerLogout: () => void;
  setCustomer: (c: Customer) => void;
}

const Ctx = createContext<AuthState>(null as any);
// Owner token lives in sessionStorage (cleared when the tab closes); customer in localStorage.
const ownerStore = safeStorage('session');
const customerStore = safeStorage('local');
const OWNER_KEY = 'mpr_owner_token';
const CUSTOMER_KEY = 'mpr_customer_token';

let ownerTokenMem: string | null = ownerStore.get(OWNER_KEY);
let customerTokenMem: string | null = customerStore.get(CUSTOMER_KEY);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [ownerReady, setOwnerReady] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const ownerLogout = useCallback(() => {
    ownerTokenMem = null;
    ownerStore.remove(OWNER_KEY);
    setOwner(null);
  }, []);

  useEffect(() => {
    configureAuth({ owner: () => ownerTokenMem, customer: () => customerTokenMem, onOwnerUnauthorized: ownerLogout });
    (async () => {
      if (ownerTokenMem) {
        try {
          const r = await api<{ owner: Owner }>('/api/owner/me');
          setOwner(r.owner);
        } catch {
          ownerLogout();
        }
      }
      if (customerTokenMem) {
        try {
          const r = await api<{ customer: Customer }>('/api/customers/me');
          setCustomer(r.customer);
        } catch {
          customerTokenMem = null;
          customerStore.remove(CUSTOMER_KEY);
        }
      }
      setOwnerReady(true);
    })();
  }, [ownerLogout]);

  const value = useMemo<AuthState>(
    () => ({
      owner,
      ownerReady,
      ownerLogout,
      async ownerLogin(email, password) {
        const r = await api<{ token: string; owner: Owner }>('/api/owner/login', { body: { email, password } });
        ownerTokenMem = r.token;
        ownerStore.set(OWNER_KEY, r.token);
        setOwner(r.owner);
      },
      customer,
      setCustomer,
      async customerLogin(email, password) {
        const r = await api<{ token: string; customer: Customer }>('/api/customers/login', { body: { email, password } });
        customerTokenMem = r.token;
        customerStore.set(CUSTOMER_KEY, r.token);
        setCustomer(r.customer);
      },
      async customerRegister(d) {
        const r = await api<{ token: string; customer: Customer }>('/api/customers/register', { body: d });
        customerTokenMem = r.token;
        customerStore.set(CUSTOMER_KEY, r.token);
        setCustomer(r.customer);
      },
      customerLogout() {
        customerTokenMem = null;
        customerStore.remove(CUSTOMER_KEY);
        setCustomer(null);
      },
    }),
    [owner, ownerReady, customer, ownerLogout]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
