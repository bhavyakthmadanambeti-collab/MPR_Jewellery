import { useEffect, useState, type FormEvent } from 'react';
import { RefreshCw, Save, Info } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { useSite } from '@/context/SiteContext';
import type { RatesResponse } from '@/types';
import { OwnerPageHeader } from '@/layouts/OwnerLayout';
import { ErrorNote, Field, Input, PageLoader, Spinner } from '@/components/ui';
import { formatDate, formatINR } from '@/utils/format';

type Hist = { metal_key: string; value: string | number; unit: string; source: string; source_type: string; recorded_at: string; owner_email: string | null };

export default function Rates() {
  const { toast } = useToast();
  const { refresh } = useSite();
  const [d, setD] = useState<(RatesResponse & { history: Hist[] }) | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [source, setSource] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'fetch' | null>(null);

  const load = () => api<RatesResponse & { history: Hist[] }>('/api/owner/rates').then((r) => {
    setD(r);
    setVals(Object.fromEntries(r.rates.map((x) => [x.key, x.value === null ? '' : String(x.value)])));
  }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!d) return;
    const changed: Record<string, number> = {};
    for (const r of d.rates) {
      const v = vals[r.key];
      if (v === '' || v === undefined) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return toast(`Enter a valid value for ${r.label}.`, 'error');
      if (n !== r.value) changed[r.key] = n;
    }
    if (!Object.keys(changed).length) return toast('No rate changes to save.', 'info');
    setBusy('save');
    try {
      await api('/api/owner/rates', { method: 'PUT', body: { values: changed, source: source.trim() || undefined } });
      toast('Rates updated. The website now shows the new rates.');
      setSource('');
      await load();
      refresh();
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(null); }
  };
  const fetchLive = async () => {
    setBusy('fetch');
    try { await api('/api/owner/rates/fetch', { method: 'POST', body: {} }); toast('Live rates fetched and saved.'); await load(); refresh(); } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(null); }
  };

  if (err) return <ErrorNote message={err} onRetry={load} />;
  if (!d) return <PageLoader />;
  const labelOf = (k: string) => d.rates.find((r) => r.key === k)?.label || k;

  return (
    <div>
      <OwnerPageHeader title="Gold/Silver Rates" sub={d.lastUpdated ? `Last updated ${formatDate(d.lastUpdated)} · ${d.label}` : 'No rates set yet'}
        action={<button onClick={fetchLive} disabled={!d.apiConfigured || !!busy} className="btn-outline btn-sm" title={d.apiConfigured ? 'Fetch from configured provider' : 'No live rate API configured'} data-testid="button-fetch-rates">{busy === 'fetch' ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Fetch live rates</button>} />
      <p className="mb-5 flex items-start gap-2 rounded-xl bg-cream px-4 py-3 text-[13px] text-cocoa-100"><Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" /> {d.apiConfigured ? 'A live rate provider is configured. If it is unavailable, your last saved rates stay on the website, labelled as stored rates.' : 'No live rate API is configured, so the website shows the rates you enter here, labelled as stored owner-approved rates with their last updated time.'}</p>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <form onSubmit={save} className="card space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {d.rates.map((r) => (
              <Field key={r.key} label={`${r.label} (₹ per ${r.unit})`} hint={r.recordedAt ? `Current ${r.value !== null ? formatINR(r.value) : '—'} · ${formatDate(r.recordedAt)}` : 'Not set'}>
                <Input type="number" min={0} step="0.01" value={vals[r.key] ?? ''} onChange={(e) => setVals({ ...vals, [r.key]: e.target.value })} data-testid={`input-rate-${r.key}`} />
              </Field>
            ))}
          </div>
          <Field label="Rate source" hint="Shown on the website, e.g. “Owner (verified with Chennai market rate)”.">
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Owner (manual entry)" data-testid="input-rate-source" />
          </Field>
          <button className="btn-primary w-full py-3" disabled={!!busy} data-testid="button-save-rates">{busy === 'save' ? <Spinner /> : <Save className="h-4 w-4" />} Save rates</button>
        </form>
        <section className="card overflow-hidden">
          <h2 className="border-b border-cocoa/5 px-5 py-4 text-xl">Rate history</h2>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="table-lux w-full">
              <thead className="sticky top-0 bg-cream"><tr><th>Rate</th><th>Value</th><th>Source</th><th>When</th></tr></thead>
              <tbody>
                {d.history.map((h, i) => (
                  <tr key={i}><td>{labelOf(h.metal_key)}</td><td className="font-medium">{formatINR(Number(h.value))}</td><td className="max-w-[160px] text-[12.5px] text-cocoa-100">{h.source}{h.owner_email ? ` · ${h.owner_email}` : ''}</td><td className="whitespace-nowrap text-[12.5px] text-cocoa-50">{formatDate(h.recorded_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
