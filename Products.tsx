import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Package, Check, X } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { api, mediaUrl } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import type { Product } from '@/types';
import { OwnerPageHeader } from '@/layouts/OwnerLayout';
import { ConfirmDialog, EmptyState, ErrorNote, Select, Skeleton, Spinner } from '@/components/ui';
import { AVAILABILITY_LABELS, CATEGORY_LABELS, METAL_LABELS, cls, formatINR } from '@/utils/format';

export default function Products() {
  const [sp, setSp] = useSearchParams();
  const { toast } = useToast();
  const qs = new URLSearchParams();
  ['q', 'category', 'metal', 'availability'].forEach((k) => sp.get(k) && qs.set(k, sp.get(k)!));
  const { data, setData, loading, error, reload } = useApi<{ items: Product[]; total: number }>(`/api/owner/products?${qs}`);
  const [del, setDel] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState(sp.get('q') || '');

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };

  const patch = async (p: Product, body: Partial<Product>, msg: string) => {
    try {
      const u = await api<Product>(`/api/owner/products/${p.id}`, { method: 'PUT', body });
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === p.id ? u : x)) });
      toast(msg);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const doDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/api/owner/products/${del.id}`, { method: 'DELETE' });
      setData((d) => d && { ...d, items: d.items.filter((x) => x.id !== del.id), total: d.total - 1 });
      toast('Product deleted.');
      setDel(null);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <OwnerPageHeader title="Products" sub={data ? `${data.total} products` : undefined} action={<Link to="/owner/products/add" className="btn-primary btn-sm" data-testid="link-add-product"><Plus className="h-4 w-4" /> Add Product</Link>} />
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <form onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }} className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-50" />
          <input className="input pl-10" placeholder="Search name, SKU, description" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => set('q', q.trim())} data-testid="input-owner-product-search" />
        </form>
        <Select value={sp.get('category') || ''} onChange={(e) => set('category', e.target.value)} className="sm:w-40" aria-label="Filter by category" data-testid="select-owner-category">
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select value={sp.get('metal') || ''} onChange={(e) => set('metal', e.target.value)} className="sm:w-36" aria-label="Filter by metal" data-testid="select-owner-metal">
          <option value="">All metals</option>
          {Object.entries(METAL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select value={sp.get('availability') || ''} onChange={(e) => set('availability', e.target.value)} className="sm:w-44" aria-label="Filter by availability">
          <option value="">Any availability</option>
          {Object.entries(AVAILABILITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>

      {error && <ErrorNote message={error} onRetry={() => reload()} />}
      {loading && !data ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div> : data && data.items.length === 0 ? (
        <EmptyState icon={<Package className="h-5 w-5" />} title="No products found" text="Add your first product or change the filters." action={<Link to="/owner/products/add" className="btn-primary btn-sm">Add Product</Link>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-lux w-full min-w-[860px]">
              <thead className="bg-cream/60"><tr><th>Product</th><th>Category</th><th>Metal / Purity</th><th>Weight</th><th>Price</th><th>Availability</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {data?.items.map((p) => (
                  <tr key={p.id} data-testid={`row-product-${p.id}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-beige">{p.images[0] && <img src={mediaUrl(p.images[0].thumbUrl)} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
                        <div className="min-w-0">
                          <Link to={`/owner/products/edit/${p.id}`} className="line-clamp-1 font-medium hover:text-gold-dark">{p.name}</Link>
                          <p className="text-[12px] text-cocoa-50">{p.sku} · {p.images.length} img · {p.videos.length} video{!p.isActive && <span className="ml-1.5 rounded bg-cocoa/10 px-1.5 py-px text-[10.5px]">Hidden</span>}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-cocoa-100">{CATEGORY_LABELS[p.category]}</td>
                    <td className="text-cocoa-100">{METAL_LABELS[p.metalType]} · {p.purity}</td>
                    <td className="text-cocoa-100">{p.weightGrams} g</td>
                    <td><PriceCell p={p} onSave={(price) => patch(p, { price }, 'Price updated.')} /></td>
                    <td>
                      <select value={p.availability} onChange={(e) => patch(p, { availability: e.target.value as any }, 'Availability updated.')} className={cls('rounded-full border px-2.5 py-1 text-[12.5px] outline-none focus:ring-2 focus:ring-gold/30', p.availability === 'in_stock' ? 'border-success/25 bg-[#EEF5EC] text-success' : p.availability === 'out_of_stock' ? 'border-danger/20 bg-[#FBEFEC] text-danger' : 'border-gold/30 bg-[#F8F0DF] text-gold-dark')} aria-label="Availability" data-testid={`select-availability-${p.id}`}>
                        {Object.entries(AVAILABILITY_LABELS).map(([k, l]) => <option key={k} value={k}>{k === 'out_of_stock' ? 'Unavailable' : l}</option>)}
                      </select>
                      {p.availability === 'in_stock' && <p className="mt-1 text-[11.5px] text-cocoa-50">Stock: {p.stock}</p>}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <Link to={`/owner/products/edit/${p.id}`} className="rounded-full p-2 text-cocoa-100 hover:bg-beige hover:text-cocoa" aria-label="Edit" data-testid={`button-edit-${p.id}`}><Pencil className="h-4 w-4" /></Link>
                        <button onClick={() => setDel(p)} className="rounded-full p-2 text-cocoa-100 hover:bg-[#FBEFEC] hover:text-danger" aria-label="Delete" data-testid={`button-delete-${p.id}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!del} title="Delete product?" text={`“${del?.name}” and all its images and videos will be permanently deleted. Existing orders keep their snapshot. This cannot be undone.`} busy={busy} onClose={() => setDel(null)} onConfirm={doDelete} />
    </div>
  );
}

function PriceCell({ p, onSave }: { p: Product; onSave: (price: number) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(String(p.price));
  const [busy, setBusy] = useState(false);
  if (!edit) return <button onClick={() => { setV(String(p.price)); setEdit(true); }} className="rounded-lg px-1.5 py-1 font-medium hover:bg-beige" title="Change price" data-testid={`button-price-${p.id}`}>{formatINR(p.price)}</button>;
  const save = async () => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    await onSave(n);
    setBusy(false);
    setEdit(false);
  };
  return (
    <div className="flex items-center gap-1">
      <input autoFocus type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEdit(false); }} className="input w-28 px-2 py-1.5 text-sm" aria-label="New price" data-testid={`input-price-${p.id}`} />
      <button onClick={save} className="rounded-full p-1.5 text-success hover:bg-[#EEF5EC]" aria-label="Save price" data-testid={`button-save-price-${p.id}`}>{busy ? <Spinner /> : <Check className="h-4 w-4" />}</button>
      <button onClick={() => setEdit(false)} className="rounded-full p-1.5 text-cocoa-50 hover:bg-beige" aria-label="Cancel"><X className="h-4 w-4" /></button>
    </div>
  );
}
