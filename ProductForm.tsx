import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Save } from 'lucide-react';
import { api, mediaUrl, upload } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import type { Product } from '@/types';
import { OwnerPageHeader } from '@/layouts/OwnerLayout';
import { ErrorNote, Field, Input, PageLoader, Select, Spinner, Textarea, Toggle } from '@/components/ui';
import { DropZone, IMAGE_ACCEPT, MediaGrid, StagedGrid, VIDEO_ACCEPT, classifyFile, type ManagedItem, type StagedFile } from '@/components/owner/MediaManager';
import { useUploader } from '@/hooks/useUploader';
import { AVAILABILITY_LABELS, CATEGORY_LABELS, METAL_LABELS } from '@/utils/format';
import { siteHref } from '@/utils/asset';

type F = { name: string; description: string; category: string; metalType: string; purity: string; weightGrams: string; price: string; stock: string; availability: string; sku: string; isFeatured: boolean; isActive: boolean };
const blank: F = { name: '', description: '', category: 'rings', metalType: 'gold', purity: '22K (916)', weightGrams: '', price: '', stock: '1', availability: 'in_stock', sku: '', isFeatured: false, isActive: true };
const PURITIES: Record<string, string[]> = { gold: ['24K (999)', '22K (916)', '18K (750)', '14K (585)'], silver: ['925 Sterling', '999 Fine'], diamond: ['VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', '18K + Diamond'], platinum: ['PT950'], other: [] };
const MAX_IMG = 15 * 1024 * 1024;
const MAX_VID = 200 * 1024 * 1024;

function fromProduct(p: Product): F {
  return { name: p.name, description: p.description, category: p.category, metalType: p.metalType, purity: p.purity, weightGrams: String(p.weightGrams), price: String(p.price), stock: String(p.stock), availability: p.availability, sku: p.sku, isFeatured: p.isFeatured, isActive: p.isActive };
}
function validate(f: F) {
  const e: Partial<Record<keyof F, string>> = {};
  if (f.name.trim().length < 2) e.name = 'Product name is required';
  if (!f.sku.trim() || !/^[A-Za-z0-9-_]{2,40}$/.test(f.sku.trim())) e.sku = 'SKU: letters, numbers, - and _';
  if (!(Number(f.price) > 0)) e.price = 'Enter a price greater than 0';
  if (f.weightGrams === '' || Number(f.weightGrams) < 0 || Number.isNaN(Number(f.weightGrams))) e.weightGrams = 'Enter the weight in grams';
  if (!Number.isInteger(Number(f.stock)) || Number(f.stock) < 0) e.stock = 'Stock must be 0 or more';
  return e;
}

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const nav = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [f, setF] = useState<F>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof F, string>>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [stagedVideos, setStagedVideos] = useState<StagedFile[]>([]);
  const [finishing, setFinishing] = useState<string | null>(null);
  const imgUp = useUploader<Product>();
  const vidUp = useUploader<Product>();

  useEffect(() => {
    if (!isEdit) return;
    api<Product>(`/api/owner/products/${id}`).then((p) => { setProduct(p); setF(fromProduct(p)); }).catch((e) => setLoadErr(e.message));
  }, [id, isEdit]);

  const set = <K extends keyof F>(k: K, v: F[K]) => { setF((cur) => ({ ...cur, [k]: v })); if (errors[k]) setErrors({ ...errors, [k]: undefined }); };

  const accept = (files: File[], kind: 'image' | 'video') => {
    const good: File[] = [];
    for (const file of files) {
      const k = classifyFile(file);
      if (k !== kind) { toast(`${file.name}: ${kind === 'image' ? 'use JPG, JPEG, PNG or WEBP' : 'use MP4, WEBM or MOV'}.`, 'error'); continue; }
      if (file.size > (kind === 'image' ? MAX_IMG : MAX_VID)) { toast(`${file.name} is too large (max ${kind === 'image' ? '15' : '200'} MB).`, 'error'); continue; }
      good.push(file);
    }
    return good;
  };

  const onImages = async (files: File[]) => {
    const good = accept(files, 'image');
    if (!good.length) return;
    if (!isEdit) return setStaged((s) => [...s, ...good.map((file, i) => ({ key: `${Date.now()}-${i}`, file, kind: 'image' as const, preview: URL.createObjectURL(file) }))]);
    const r = await imgUp.run(`/api/owner/products/${id}/images`, 'images', good, setProduct);
    if (r.ok) toast(`${r.ok} image${r.ok > 1 ? 's' : ''} uploaded.`);
    r.errors.forEach((m) => toast(m, 'error'));
  };
  const onVideos = async (files: File[]) => {
    const good = accept(files, 'video');
    if (!good.length) return;
    if (!isEdit) return setStagedVideos((s) => [...s, ...good.map((file, i) => ({ key: `${Date.now()}-v${i}`, file, kind: 'video' as const, preview: URL.createObjectURL(file) }))]);
    const r = await vidUp.run(`/api/owner/products/${id}/videos`, 'videos', good, setProduct);
    if (r.ok) toast(`${r.ok} video${r.ok > 1 ? 's' : ''} uploaded.`);
    r.errors.forEach((m) => toast(m, 'error'));
  };

  const body = () => ({ ...f, weightGrams: Number(f.weightGrams), price: Number(f.price), stock: Number(f.stock), sku: f.sku.trim() });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(f);
    setErrors(v);
    if (Object.keys(v).length) return toast('Please fix the highlighted fields.', 'error');
    setSaving(true);
    setSaveErr(null);
    try {
      if (isEdit) {
        const p = await api<Product>(`/api/owner/products/${id}`, { method: 'PUT', body: body() });
        setProduct(p);
        setF(fromProduct(p));
        toast('Product updated successfully.');
      } else {
        const p = await api<Product>('/api/owner/products', { body: body() });
        const all = [...staged, ...stagedVideos];
        let failed = 0;
        for (let i = 0; i < all.length; i++) {
          const s = all[i];
          setFinishing(`Uploading ${s.kind} ${i + 1} of ${all.length}… 0%`);
          const fd = new FormData();
          fd.append(s.kind === 'image' ? 'images' : 'videos', s.file);
          try {
            await upload(`/api/owner/products/${p.id}/${s.kind === 'image' ? 'images' : 'videos'}`, fd, (pct) => setFinishing(`Uploading ${s.kind} ${i + 1} of ${all.length}… ${pct}%`));
          } catch {
            failed++;
          }
        }
        setFinishing(null);
        toast(failed ? `Product created. ${failed} file(s) failed to upload — try again from the edit page.` : 'Product created successfully.', failed ? 'error' : 'success');
        nav(`/owner/products/edit/${p.id}`, { replace: true });
      }
    } catch (e: any) {
      setSaveErr(e.message);
      toast(e.message, 'error');
    } finally {
      setSaving(false);
      setFinishing(null);
    }
  };

  if (loadErr) return <ErrorNote message={loadErr} />;
  if (isEdit && !product) return <PageLoader />;

  const imgItems: ManagedItem[] = (product?.images || []).map((i) => ({ id: i.id, kind: 'image', url: i.url, thumbUrl: i.thumbUrl }));
  const vidItems: ManagedItem[] = (product?.videos || []).map((v) => ({ id: v.id, kind: 'video', url: v.url, posterUrl: v.posterUrl }));

  return (
    <form onSubmit={submit} noValidate>
      <Link to="/owner/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-cocoa-50 hover:text-cocoa"><ArrowLeft className="h-4 w-4" /> All products</Link>
      <OwnerPageHeader
        title={isEdit ? 'Edit Product' : 'Add Product'}
        sub={isEdit ? product!.name : 'Fill in the details and add photos.'}
        action={isEdit && product!.isActive ? <a href={siteHref(`/products/${product!.slug}`)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm"><ExternalLink className="h-4 w-4" /> View on site</a> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="text-xl">Details</h2>
            <Field label="Product name" error={errors.name}><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Gold Ring" data-testid="input-product-name" /></Field>
            <Field label="Description"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={5} placeholder="Design, finish, occasion…" data-testid="input-product-description" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category"><Select value={f.category} onChange={(e) => set('category', e.target.value)} data-testid="select-product-category">{Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Metal type">
                <Select value={f.metalType} onChange={(e) => { const m = e.target.value; setF((c) => ({ ...c, metalType: m, purity: PURITIES[m]?.[0] ?? c.purity })); }} data-testid="select-product-metal">{Object.entries(METAL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              </Field>
              <Field label="Purity">
                <Input value={f.purity} onChange={(e) => set('purity', e.target.value)} list="purity-list" data-testid="input-product-purity" />
                <datalist id="purity-list">{(PURITIES[f.metalType] || []).map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
              <Field label="Weight (grams)" error={errors.weightGrams}><Input type="number" step="0.001" min={0} value={f.weightGrams} onChange={(e) => set('weightGrams', e.target.value)} data-testid="input-product-weight" /></Field>
              <Field label="SKU / Product code" error={errors.sku}><Input value={f.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} placeholder="MPR-GR-101" data-testid="input-product-sku" /></Field>
            </div>
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <div><h2 className="text-xl">Product images</h2><p className="text-[13px] text-cocoa-50">First image is the cover. Drag or use the arrows to reorder.</p></div>
            <DropZone accept={IMAGE_ACCEPT} onFiles={onImages} label="Upload Product Images" sub="JPG, JPEG, PNG or WEBP · up to 15 MB each" testId="button-upload-images" />
            {isEdit ? (
              <MediaGrid
                items={imgItems}
                pending={imgUp.pending}
                replaceAccept={IMAGE_ACCEPT}
                emptyText="No images yet. Products without images show a placeholder."
                onDelete={async (mid) => { setProduct(await api<Product>(`/api/owner/products/${id}/images/${mid}`, { method: 'DELETE' })); toast('Image deleted.'); }}
                onReplace={async (mid, file) => {
                  if (!accept([file], 'image').length) return;
                  const fd = new FormData(); fd.append('image', file);
                  try { setProduct(await upload<Product>(`/api/owner/products/${id}/images/${mid}`, fd, () => {}, 'PUT')); toast('Image replaced.'); } catch (e: any) { toast(e.message, 'error'); }
                }}
                onReorder={async (ids) => { try { setProduct(await api<Product>(`/api/owner/products/${id}/images/order`, { method: 'PUT', body: { ids } })); toast('Image order saved.', 'info'); } catch (e: any) { toast(e.message, 'error'); } }}
              />
            ) : <StagedGrid files={staged} onChange={setStaged} />}
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <div><h2 className="text-xl">Product videos</h2><p className="text-[13px] text-cocoa-50">Optional short clips shown on the product page.</p></div>
            <DropZone accept={VIDEO_ACCEPT} onFiles={onVideos} label="Upload Product Video" sub="MP4, WEBM or MOV · up to 200 MB" icon="video" testId="button-upload-videos" />
            {isEdit ? (
              <MediaGrid
                items={vidItems}
                pending={vidUp.pending}
                replaceAccept={VIDEO_ACCEPT}
                emptyText="No videos yet."
                onDelete={async (vid) => { setProduct(await api<Product>(`/api/owner/products/${id}/videos/${vid}`, { method: 'DELETE' })); toast('Video deleted.'); }}
                onReplace={async (vid, file) => {
                  if (!accept([file], 'video').length) return;
                  const fd = new FormData(); fd.append('video', file);
                  try { setProduct(await upload<Product>(`/api/owner/products/${id}/videos/${vid}`, fd, () => {}, 'PUT')); toast('Video replaced.'); } catch (e: any) { toast(e.message, 'error'); }
                }}
              />
            ) : <StagedGrid files={stagedVideos} onChange={setStagedVideos} />}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card space-y-4 p-5 sm:p-6 xl:sticky xl:top-6">
            <h2 className="text-xl">Price & availability</h2>
            <Field label="Price (₹)" error={errors.price} hint="Only you can set prices. Customers are always charged the price stored on the server.">
              <Input type="number" min={1} step="1" value={f.price} onChange={(e) => set('price', e.target.value)} data-testid="input-product-price" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Availability"><Select value={f.availability} onChange={(e) => set('availability', e.target.value)} data-testid="select-product-availability">{Object.entries(AVAILABILITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Stock" error={errors.stock}><Input type="number" min={0} step="1" value={f.stock} onChange={(e) => set('stock', e.target.value)} data-testid="input-product-stock" /></Field>
            </div>
            <div className="hairline" />
            <Toggle checked={f.isActive} onChange={(v) => set('isActive', v)} label="Visible on website" description="Hidden products stay in your catalogue but customers cannot see them." />
            <Toggle checked={f.isFeatured} onChange={(v) => set('isFeatured', v)} label="Featured on homepage" />
            {saveErr && <ErrorNote message={saveErr} />}
            {finishing && <p className="rounded-xl bg-beige/70 px-3 py-2 text-[13px] text-cocoa-100" data-testid="text-upload-status">{finishing}</p>}
            <button className="btn-primary w-full py-3" disabled={saving} data-testid="button-save-product">{saving ? <Spinner /> : <Save className="h-4 w-4" />} {isEdit ? 'Save changes' : 'Create product'}</button>
            {isEdit && product!.images[0] && <img src={mediaUrl(product!.images[0].thumbUrl)} alt="" className="hidden" />}
          </section>
        </div>
      </div>
    </form>
  );
}
