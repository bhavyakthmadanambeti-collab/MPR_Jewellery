import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Images, ArrowUp, ArrowDown, Pencil, Trash2, Star, ArrowLeft, Save, Eye, EyeOff, Info } from 'lucide-react';
import { api, mediaUrl, upload } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { useSite } from '@/context/SiteContext';
import type { Collection } from '@/types';
import { OwnerPageHeader } from '@/layouts/OwnerLayout';
import { ConfirmDialog, EmptyState, ErrorNote, Field, Input, Modal, PageLoader, Spinner, Textarea, Toggle } from '@/components/ui';
import { DropZone, MediaGrid, classifyFile, IMAGE_ACCEPT, VIDEO_ACCEPT, type ManagedItem } from '@/components/owner/MediaManager';
import { useUploader } from '@/hooks/useUploader';
import { cls, timeAgo } from '@/utils/format';
import { siteHref } from '@/utils/asset';

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={cls('rounded-full px-2 py-0.5 text-[11px] font-medium', on ? 'bg-[#EEF5EC] text-success' : 'bg-cocoa/[0.07] text-cocoa-50')}>{children}</span>;
}

export default function OwnerCollections() {
  const { toast } = useToast();
  const nav = useNavigate();
  const [items, setItems] = useState<Collection[] | null>(null);
  const [heroId, setHeroId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Collection | null>(null);

  const load = () => api<{ items: Collection[]; heroCollectionId: number | null }>('/api/owner/collections').then((r) => { setItems(r.items); setHeroId(r.heroCollectionId); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return;
    setBusy(true);
    try {
      const c = await api<Collection>('/api/owner/collections', { body: { title: title.trim(), isPublished: false, isVisible: true, showOnHome: true } });
      toast('Collection created. Add images or videos next.');
      nav(`/owner/collections/${c.id}`);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const move = async (i: number, d: -1 | 1) => {
    if (!items) return;
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    setItems(n);
    try { setItems(await api<Collection[]>('/api/owner/collections/order', { method: 'PUT', body: { ids: n.map((c) => c.id) } })); toast('Collection order saved.', 'info'); } catch (e: any) { toast(e.message, 'error'); load(); }
  };
  const toggle = async (c: Collection, patch: Partial<Collection>, msg: string) => {
    try {
      const u = await api<Collection>(`/api/owner/collections/${c.id}`, { method: 'PUT', body: patch });
      setItems((l) => l && l.map((x) => (x.id === c.id ? u : x)));
      toast(msg);
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const doDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/api/owner/collections/${del.id}`, { method: 'DELETE' });
      toast('Collection deleted.');
      setDel(null);
      load();
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (err) return <ErrorNote message={err} onRetry={load} />;
  return (
    <div>
      <OwnerPageHeader title="Home Collections" sub="Promotional images and videos shown on the homepage. Customers don't see Buy Now on this media." action={<button onClick={() => setCreating(true)} className="btn-primary btn-sm" data-testid="button-new-collection"><Plus className="h-4 w-4" /> New Collection</button>} />
      {!items ? <PageLoader /> : items.length === 0 ? (
        <EmptyState icon={<Images className="h-5 w-5" />} title="No collections yet" text="Create a collection and upload promotional images or videos." action={<button onClick={() => setCreating(true)} className="btn-primary btn-sm">New Collection</button>} />
      ) : (
        <div className="space-y-3">
          {items.map((c, i) => {
            const cover = c.media[0];
            return (
              <div key={c.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center" data-testid={`row-collection-${c.id}`}>
                <div className="flex items-center gap-4 sm:flex-1">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-1 text-cocoa-50 hover:bg-beige disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded-full p-1 text-cocoa-50 hover:bg-beige disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                  </div>
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-beige">
                    {cover && (cover.type === 'image' ? <img src={mediaUrl(cover.thumbUrl || cover.url)} alt="" className="h-full w-full object-cover" /> : cover.posterUrl ? <img src={mediaUrl(cover.posterUrl)} alt="" className="h-full w-full object-cover" /> : <video src={mediaUrl(cover.url)} muted preload="metadata" className="h-full w-full object-cover" />)}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-display text-[21px] font-semibold leading-tight">{c.title}{heroId === c.id && <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 font-sans text-[11px] font-medium text-gold-dark"><Star className="h-3 w-3 fill-current" /> Hero</span>}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill on={c.isPublished}>{c.isPublished ? 'Published' : 'Draft'}</Pill>
                      <Pill on={c.isVisible}>{c.isVisible ? 'Visible' : 'Hidden'}</Pill>
                      <Pill on={c.showOnHome}>{c.showOnHome ? 'On homepage' : 'Not on homepage'}</Pill>
                      <span className="text-[12px] text-cocoa-50">{c.mediaCount} media · updated {timeAgo(c.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <button onClick={() => toggle(c, { isPublished: !c.isPublished }, c.isPublished ? 'Collection unpublished.' : 'Collection published.')} className="btn-outline btn-sm" data-testid={`button-publish-${c.id}`}>{c.isPublished ? 'Unpublish' : 'Publish'}</button>
                  <button onClick={() => toggle(c, { isVisible: !c.isVisible }, c.isVisible ? 'Collection hidden.' : 'Collection shown.')} className="btn-ghost btn-sm" aria-label={c.isVisible ? 'Hide' : 'Show'} title={c.isVisible ? 'Hide' : 'Show'}>{c.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <Link to={`/owner/collections/${c.id}`} className="btn-primary btn-sm" data-testid={`button-edit-collection-${c.id}`}><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                  <button onClick={() => setDel(c)} className="rounded-full p-2 text-cocoa-50 hover:bg-[#FBEFEC] hover:text-danger" aria-label="Delete collection"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="New collection">
        <form onSubmit={create} className="space-y-4">
          <Field label="Collection title"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Festive Gold Collection" data-testid="input-new-collection-title" /></Field>
          <p className="text-[12.5px] text-cocoa-50">It starts as a draft. Publish it once media is added.</p>
          <button className="btn-primary w-full" disabled={busy || title.trim().length < 2} data-testid="button-create-collection">{busy && <Spinner />} Create collection</button>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Delete collection?" text={`“${del?.title}” and all of its images and videos will be permanently deleted.`} busy={busy} onClose={() => setDel(null)} onConfirm={doDelete} />
    </div>
  );
}

export function CollectionEditor() {
  const { id } = useParams();
  const { toast } = useToast();
  const { refresh } = useSite();
  const [c, setC] = useState<Collection | null>(null);
  const [heroId, setHeroId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const up = useUploader<Collection>();

  useEffect(() => {
    Promise.all([api<Collection>(`/api/owner/collections/${id}`), api<{ home: { heroCollectionId: number | null } }>('/api/owner/settings')])
      .then(([col, s]) => { setC(col); setF({ title: col.title, description: col.description }); setHeroId(s.home.heroCollectionId); })
      .catch((e) => setErr(e.message));
  }, [id]);

  const put = async (patch: Partial<Collection>, msg: string) => {
    try { setC(await api<Collection>(`/api/owner/collections/${id}`, { method: 'PUT', body: patch })); toast(msg); } catch (e: any) { toast(e.message, 'error'); }
  };
  const saveText = async (e: FormEvent) => {
    e.preventDefault();
    if (f.title.trim().length < 2) return toast('Collection title is required.', 'error');
    setSaving(true);
    await put({ title: f.title.trim(), description: f.description.trim() }, 'Collection title and description saved.');
    setSaving(false);
  };
  const setHero = async (on: boolean) => {
    try {
      await api('/api/owner/settings', { method: 'PUT', body: { home: { heroCollectionId: on ? Number(id) : null } } });
      setHeroId(on ? Number(id) : null);
      refresh();
      toast(on ? 'This collection is now the homepage hero.' : 'Removed from homepage hero.');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const onFiles = async (files: File[]) => {
    const good = files.filter((file) => {
      const k = classifyFile(file);
      if (!k) toast(`${file.name}: use JPG, PNG, WEBP, MP4, WEBM or MOV.`, 'error');
      return !!k;
    });
    if (!good.length) return;
    const r = await up.run(`/api/owner/collections/${id}/media`, 'media', good, setC);
    if (r.ok) toast(`${r.ok} file${r.ok > 1 ? 's' : ''} uploaded.`);
    r.errors.forEach((m) => toast(m, 'error'));
  };

  if (err) return <ErrorNote message={err} />;
  if (!c) return <PageLoader />;
  const items: ManagedItem[] = c.media.map((m) => ({ id: m.id, kind: m.type, url: m.url, thumbUrl: m.thumbUrl, posterUrl: m.posterUrl }));

  return (
    <div>
      <Link to="/owner/collections" className="mb-4 inline-flex items-center gap-1.5 text-sm text-cocoa-50 hover:text-cocoa"><ArrowLeft className="h-4 w-4" /> All collections</Link>
      <OwnerPageHeader title="Edit Collection" sub={c.title} action={c.isPublished && c.isVisible ? <a href={siteHref(`/collections/${c.slug}`)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm"><Eye className="h-4 w-4" /> View on site</a> : undefined} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card space-y-4 p-5 sm:p-6">
          <div><h2 className="text-xl">Images & videos</h2><p className="text-[13px] text-cocoa-50">First item is the cover. Unlimited uploads; drag or use arrows to reorder.</p></div>
          <DropZone accept={`${IMAGE_ACCEPT},${VIDEO_ACCEPT}`} onFiles={onFiles} label="Upload Collection Images/Videos" sub="JPG, PNG, WEBP, MP4, WEBM, MOV" icon="both" testId="button-upload-collection-media" />
          <MediaGrid
            items={items}
            pending={up.pending}
            replaceAccept={`${IMAGE_ACCEPT},${VIDEO_ACCEPT}`}
            emptyText="No media yet."
            onDelete={async (mid) => { setC(await api<Collection>(`/api/owner/collections/${id}/media/${mid}`, { method: 'DELETE' })); toast('Media deleted.'); }}
            onReplace={async (mid, file) => {
              if (!classifyFile(file)) return toast('Unsupported file type.', 'error');
              const fd = new FormData(); fd.append('media', file);
              try { setC(await upload<Collection>(`/api/owner/collections/${id}/media/${mid}`, fd, () => {}, 'PUT')); toast('Media replaced.'); } catch (e: any) { toast(e.message, 'error'); }
            }}
            onReorder={async (ids) => { try { setC(await api<Collection>(`/api/owner/collections/${id}/media/order`, { method: 'PUT', body: { ids } })); toast('Media order saved.', 'info'); } catch (e: any) { toast(e.message, 'error'); } }}
          />
          <p className="flex items-start gap-2 rounded-xl bg-cream px-3.5 py-2.5 text-[12.5px] text-cocoa-100"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" /> Collection media is promotional only — the website never shows Buy Now on it.</p>
        </section>
        <div className="space-y-6">
          <form onSubmit={saveText} className="card space-y-4 p-5 sm:p-6">
            <h2 className="text-xl">Title & description</h2>
            <Field label="Collection title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="input-collection-title" /></Field>
            <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className="min-h-[90px]" data-testid="input-collection-description" /></Field>
            <button className="btn-primary w-full" disabled={saving} data-testid="button-save-collection">{saving ? <Spinner /> : <Save className="h-4 w-4" />} Save</button>
          </form>
          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="text-xl">Visibility</h2>
            <Toggle checked={c.isPublished} onChange={(v) => put({ isPublished: v }, v ? 'Collection published.' : 'Collection moved to draft.')} label="Published" description="Drafts are never shown to customers." testId="toggle-published" />
            <Toggle checked={c.isVisible} onChange={(v) => put({ isVisible: v }, v ? 'Collection shown.' : 'Collection hidden.')} label="Visible" description="Temporarily hide without unpublishing." testId="toggle-visible" />
            <Toggle checked={c.showOnHome} onChange={(v) => put({ showOnHome: v }, v ? 'Shown on homepage.' : 'Removed from homepage list.')} label="Show on homepage" testId="toggle-home" />
            <Toggle checked={heroId === c.id} onChange={setHero} label="Use as homepage hero" description="Its media rotates in the large banner at the top of the homepage." testId="toggle-hero" />
            {!c.isPublished && heroId === c.id && <p className="text-[12.5px] text-warning">Publish this collection for it to appear as the hero.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
