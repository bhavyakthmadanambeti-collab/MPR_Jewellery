import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; message: string }
const Ctx = createContext<{ toast: (message: string, kind?: Kind) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = useCallback((message: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3800);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
          return (
            <div key={t.id} data-testid={`toast-${t.kind}`} className="pointer-events-auto flex w-full max-w-sm animate-fadeUp items-start gap-3 rounded-2xl bg-cocoa px-4 py-3.5 text-[14px] text-cream shadow-lift ring-1 ring-gold/30">
              <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${t.kind === 'error' ? 'text-[#F0A99C]' : 'text-gold-light'}`} />
              <p className="flex-1 leading-snug">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-cream/60 hover:text-cream" aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
