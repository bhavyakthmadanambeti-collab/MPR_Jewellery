import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSeo } from '@/hooks/useSeo';
import { Logo } from '@/components/Logo';
import { ErrorNote, Field, Input, Spinner } from '@/components/ui';
import { asset } from '@/utils/asset';

export default function OwnerLogin() {
  useSeo('Owner Login');
  const { owner, ownerLogin, ownerReady } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (ownerReady && owner) return <Navigate to="/owner/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setErr('Enter your email and password.');
    setBusy(true);
    setErr(null);
    try {
      await ownerLogin(email.trim(), password);
      toast('Welcome back. You are signed in.');
      nav(loc.state?.from || '/owner/dashboard', { replace: true });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-cocoa lg:block">
        <img src={asset('og-image.jpg')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <Logo light />
          <p className="mt-4 max-w-sm text-[15px] text-cream/70">Manage products, collections, rates and verify customer payments.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-cream px-5 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 inline-flex items-center gap-1.5 text-sm text-cocoa-50 hover:text-cocoa"><ArrowLeft className="h-4 w-4" /> Back to store</Link>
          <div className="lg:hidden"><Logo /></div>
          <p className="eyebrow mt-8 flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Owner Portal</p>
          <h1 className="mt-2 text-[34px]">Owner sign in</h1>
          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" data-testid="input-owner-email" /></Field>
            <Field label="Password">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="pr-11" data-testid="input-owner-password" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-50 hover:text-cocoa" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </Field>
            {err && <ErrorNote message={err} />}
            <button className="btn-primary w-full py-3" disabled={busy} data-testid="button-owner-login">{busy ? <><Spinner /> Signing in…</> : 'Sign in'}</button>
          </form>
          <p className="mt-6 text-[12.5px] leading-relaxed text-cocoa-50">This area is for the store owner only. Sessions expire automatically; you can change your password in Settings.</p>
        </div>
      </div>
    </div>
  );
}
