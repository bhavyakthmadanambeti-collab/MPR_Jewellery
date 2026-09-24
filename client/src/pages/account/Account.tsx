import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, Package, User, MapPin, Trash2, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSeo } from '@/hooks/useSeo';
import { useApi } from '@/hooks/useApi';
import { api } from '@/services/api';
import type { Order } from '@/types';
import { EmptyState, ErrorNote, Field, Input, Modal, PageLoader, Spinner, StatusBadge, Textarea } from '@/components/ui';
import { cls, formatDate, formatINR } from '@/utils/format';

export function CustomerAuth() {
  useSeo('Sign in');
  const { customer, customerLogin, customerRegister } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { toast } = useToast();
  const next = sp.get('next') || '/account';
  if (customer) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'login') await customerLogin(f.email, f.password);
      else await customerRegister(f);
      toast(mode === 'login' ? 'Welcome back.' : 'Your account has been created.');
      nav(next, { replace: true });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="container-lux max-w-md pt-12 sm:pt-16">
      <p className="eyebrow">My account</p>
      <h1 className="mt-2 text-[36px]">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <div className="mt-6 grid grid-cols-2 rounded-full bg-beige/70 p-1 text-sm">
        {(['login', 'register'] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setErr(null); }} className={cls('rounded-full py-2 transition', mode === m ? 'bg-pearl font-medium shadow-soft' : 'text-cocoa-100')} data-testid={`tab-${m}`}>{m === 'login' ? 'Sign in' : 'Register'}</button>
        ))}
      </div>
      <form onSubmit={submit} className="card mt-5 space-y-4 p-6">
        {mode === 'register' && <Field label="Full name"><Input value={f.name} onChange={set('name')} required autoComplete="name" data-testid="input-reg-name" /></Field>}
        <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} required autoComplete="email" data-testid="input-cust-email" /></Field>
        {mode === 'register' && <Field label="Mobile number"><Input value={f.phone} onChange={set('phone')} inputMode="numeric" maxLength={10} required data-testid="input-reg-phone" /></Field>}
        <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}><Input type="password" value={f.password} onChange={set('password')} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} data-testid="input-cust-password" /></Field>
        {err && <ErrorNote message={err} />}
        <button className="btn-primary w-full py-3" disabled={busy} data-testid="button-cust-submit">{busy && <Spinner />} {mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p className="mt-5 text-center text-sm text-cocoa-50">Ordered as a guest? <Link to="/track-order" className="text-gold-dark underline underline-offset-4">Track your order</Link></p>
    </div>
  );
}

interface Address { id: number; fullName: string; phone: string; address: string; city: string; state: string; pincode: string; isDefault: boolean }

export default function Account() {
  useSeo('My Account');
  const { customer, customerLogout, setCustomer, ownerReady } = useAuth();
  const [tab, setTab] = useState<'orders' | 'profile' | 'addresses'>('orders');
  if (!customer) return ownerReady ? <Navigate to="/account/login" replace /> : <PageLoader />;
  return (
    <div className="container-lux pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">My account</p><h1 className="mt-2 text-[34px]">Hello, {customer.name.split(' ')[0]}</h1></div>
        <button className="btn-outline btn-sm" onClick={customerLogout} data-testid="button-cust-logout"><LogOut className="h-4 w-4" /> Sign out</button>
      </div>
      <div className="scrollbar-none mt-7 flex gap-2 overflow-x-auto border-b border-cocoa/[0.07] pb-3">
        {([['orders', 'My Orders', Package], ['profile', 'Profile', User], ['addresses', 'Saved Address', MapPin]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={cls('chip shrink-0', tab === k && 'chip-active')} data-testid={`tab-account-${k}`}><I className="h-3.5 w-3.5" /> {l}</button>
        ))}
      </div>
      <div className="mt-7">
        {tab === 'orders' && <MyOrders />}
        {tab === 'profile' && <Profile onSaved={setCustomer} />}
        {tab === 'addresses' && <Addresses />}
      </div>
    </div>
  );
}

function MyOrders() {
  const { data, loading, error, reload } = useApi<Order[]>('/api/customers/me/orders');
  if (loading) return <PageLoader />;
  if (error) return <ErrorNote message={error} onRetry={() => reload()} />;
  if (!data?.length) return <EmptyState icon={<Package className="h-5 w-5" />} title="No orders yet" text="Your orders will appear here." action={<Link to="/jewellery" className="btn-primary">Start shopping</Link>} />;
  return (
    <div className="space-y-3">
      {data.map((o) => (
        <Link key={o.id} to={`/order/${o.orderNumber}`} className="card flex flex-col gap-3 p-5 transition hover:shadow-lift sm:flex-row sm:items-center sm:justify-between" data-testid={`row-my-order-${o.id}`}>
          <div className="min-w-0">
            <p className="font-medium">{o.orderNumber}</p>
            <p className="mt-0.5 line-clamp-1 text-[13.5px] text-cocoa-50">{o.itemSummary} · {formatDate(o.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge kind="payment" status={o.paymentStatus} />
            <StatusBadge kind="order" status={o.orderStatus} />
            <span className="font-display text-[20px] font-semibold">{formatINR(o.totalAmount)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Profile({ onSaved }: { onSaved: (c: any) => void }) {
  const { customer } = useAuth();
  const { toast } = useToast();
  const [f, setF] = useState({ name: customer!.name, phone: customer!.phone || '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ customer: any }>('/api/customers/me', { method: 'PUT', body: f });
      onSaved(r.customer);
      toast('Profile updated.');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="card max-w-lg space-y-4 p-6">
      <Field label="Full name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Mobile number"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="numeric" maxLength={10} /></Field>
      <Field label="Email"><Input value={customer!.email} disabled /></Field>
      {err && <ErrorNote message={err} />}
      <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save profile</button>
    </form>
  );
}

const emptyAddr = { fullName: '', phone: '', address: '', city: '', state: 'Tamil Nadu', pincode: '', isDefault: true };

function Addresses() {
  const { toast } = useToast();
  const [list, setList] = useState<Address[] | null>(null);
  const [edit, setEdit] = useState<(typeof emptyAddr & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => api<{ addresses: Address[] }>('/api/customers/me').then((r) => setList(r.addresses));
  useEffect(() => { load(); }, []);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setErr(null);
    try {
      const { id, ...body } = edit;
      await api(id ? `/api/customers/me/addresses/${id}` : '/api/customers/me/addresses', { method: id ? 'PUT' : 'POST', body });
      toast('Address saved.');
      setEdit(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: number) => {
    await api(`/api/customers/me/addresses/${id}`, { method: 'DELETE' });
    toast('Address removed.');
    load();
  };
  if (!list) return <PageLoader />;
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{a.fullName} {a.isDefault && <span className="ml-2 rounded-full bg-beige px-2 py-0.5 text-[11px] text-gold-dark">Default</span>}</p>
              <button onClick={() => del(a.id)} className="rounded-full p-1.5 text-cocoa-50 hover:text-danger" aria-label="Delete address"><Trash2 className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-[14px] text-cocoa-100">{a.address}, {a.city}, {a.state} – {a.pincode}</p>
            <p className="text-[14px] text-cocoa-100">{a.phone}</p>
            <button className="mt-3 text-[13px] text-gold-dark underline underline-offset-4" onClick={() => setEdit({ ...a })}>Edit</button>
          </div>
        ))}
        <button onClick={() => setEdit({ ...emptyAddr })} className="flex min-h-[140px] items-center justify-center gap-2 rounded-2xl border border-dashed border-cocoa/20 text-sm text-cocoa-100 hover:border-gold hover:text-cocoa"><Plus className="h-4 w-4" /> Add address</button>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit address' : 'Add address'}>
        {edit && (
          <form onSubmit={save} className="space-y-3.5">
            <Field label="Full name"><Input value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></Field>
            <Field label="Mobile"><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} maxLength={10} inputMode="numeric" /></Field>
            <Field label="Address"><Textarea value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} className="min-h-[80px]" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><Input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
              <Field label="Pincode"><Input value={edit.pincode} onChange={(e) => setEdit({ ...edit, pincode: e.target.value })} maxLength={6} inputMode="numeric" /></Field>
            </div>
            <Field label="State"><Input value={edit.state} onChange={(e) => setEdit({ ...edit, state: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#B8893B]" checked={edit.isDefault} onChange={(e) => setEdit({ ...edit, isDefault: e.target.checked })} /> Set as default</label>
            {err && <ErrorNote message={err} />}
            <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />} Save address</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
