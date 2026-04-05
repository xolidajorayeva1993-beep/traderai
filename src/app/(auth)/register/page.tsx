'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { signUpEmail, signInGoogle } from '@/lib/firebase/auth';

const schema = z
  .object({
    displayName:     z.string().min(2, 'Ism kamida 2 ta belgi').max(50),
    email:           z.string().email("To'g'ri email kiriting"),
    password:        z
      .string()
      .min(8, 'Parol kamida 8 ta belgi')
      .regex(/[A-Z]/, 'Kamida 1 ta katta harf')
      .regex(/[0-9]/, 'Kamida 1 ta raqam'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Parollar mos kelmaydi',
    path:    ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const PASSWORD_RULES = [
  { label: '8+ belgi',   test: (v: string) => v.length >= 8 },
  { label: 'Katta harf', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Raqam',      test: (v: string) => /[0-9]/.test(v) },
];

const ipt: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
  padding: '13px 16px', color: '#E8E9EF', fontSize: 14,
  outline: 'none', transition: 'border-color .2s, box-shadow .2s',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="bg-[#0D0F16] border border-white/8 rounded-2xl p-8 h-[520px] animate-pulse" />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const params  = useSearchParams();
  const plan    = params.get('plan') ?? 'free';

  const [showPwd, setShowPwd]             = useState(false);
  const [focus, setFocus]                 = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError]     = useState('');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const password = watch('password', '');

  const setAuthAndRedirect = (dest = '/dashboard') => {
    document.cookie = '__auth=1; path=/; max-age=604800; SameSite=Lax';
    window.location.href = dest;
  };

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await signUpEmail(data.email, data.password, data.displayName);
      setAuthAndRedirect('/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code.includes('email-already-in-use')) {
        setServerError("Bu email bilan hisob mavjud. Kirish sahifasiga o'ting.");
      } else {
        setServerError("Ro'yxatdan o'tishda xato. Qayta urinib ko'ring.");
      }
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setServerError('');
    try {
      await signInGoogle();
      setAuthAndRedirect('/dashboard');
    } catch {
      setServerError("Google orqali kirish muvaffaqiyatsiz bo'ldi.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const focusStyle = (name: string): React.CSSProperties =>
    focus === name
      ? { ...ipt, borderColor: '#00D4AA', boxShadow: '0 0 0 3px rgba(0,212,170,0.15)' }
      : { ...ipt };

  return (
    // Gradient-border wrapper
    <div style={{
      background: 'linear-gradient(135deg, rgba(0,212,170,0.35) 0%, rgba(91,139,255,0.2) 50%, rgba(255,255,255,0.07) 100%)',
      borderRadius: 22, padding: 1,
      boxShadow: '0 0 70px rgba(0,212,170,0.1), 0 30px 80px rgba(0,0,0,0.7)',
    }}>
      {/* Card */}
      <div style={{
        background: 'linear-gradient(160deg, #111520 0%, #0C0E18 100%)',
        borderRadius: 21, padding: '2.25rem',
      }}>
        {/* Top accent */}
        <div style={{ height: 2, background: 'linear-gradient(90deg,#00D4AA,#5B8BFF,transparent)', borderRadius: 2, marginBottom: '2rem' }} />

        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ color: '#F0F1F5', fontWeight: 800, fontSize: 22, margin: 0, marginBottom: 4 }}>Hisob yaratish</h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, margin: 0 }}>
            {plan !== 'free' ? (
              <><span style={{ color: '#00D4AA', fontWeight: 600 }}>{plan}</span> rejasi bilan boshlang</>
            ) : (
              'FATH AI signallari bilan savdoni boshlang'
            )}
          </p>
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={googleLoading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12, padding: '13px 20px', color: '#E8E9EF', fontSize: 14,
            fontWeight: 500, cursor: 'pointer', marginBottom: '1.5rem',
            opacity: googleLoading ? 0.5 : 1,
          }}>
          {googleLoading ? <Loader2 size={16} className="animate-spin" /> : (
            <svg width="17" height="17" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Google orqali ro&apos;yxatdan o&apos;tish
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>yoki</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && (
            <div style={{ background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.28)', borderRadius: 12, padding: '12px 16px', color: '#FF4D6A', fontSize: 14 }}>
              {serverError}
            </div>
          )}

          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>To&apos;liq ism</label>
            <input {...register('displayName')} placeholder="Sarvar Toshmatov"
              style={focusStyle('name')} onFocus={() => setFocus('name')} onBlur={() => setFocus(null)} />
            {errors.displayName && <p style={{ color: '#FF4D6A', fontSize: 12, marginTop: 6 }}>{errors.displayName.message}</p>}
          </div>

          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Email manzil</label>
            <input {...register('email')} type="email" autoComplete="email" placeholder="email@misol.com"
              style={focusStyle('email')} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} />
            {errors.email && <p style={{ color: '#FF4D6A', fontSize: 12, marginTop: 6 }}>{errors.email.message}</p>}
          </div>

          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Parol</label>
            <div style={{ position: 'relative' }}>
              <input {...register('password')} type={showPwd ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••"
                style={{ ...focusStyle('pwd'), paddingRight: 44 }} onFocus={() => setFocus('pwd')} onBlur={() => setFocus(null)} />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                {PASSWORD_RULES.map((rule) => (
                  <span key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: rule.test(password) ? '#00D4AA' : 'rgba(255,255,255,0.25)', transition: 'color .2s' }}>
                    <CheckCircle2 size={12} />{rule.label}
                  </span>
                ))}
              </div>
            )}
            {errors.password && <p style={{ color: '#FF4D6A', fontSize: 12, marginTop: 6 }}>{errors.password.message}</p>}
          </div>

          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Parolni tasdiqlang</label>
            <input {...register('confirmPassword')} type="password" autoComplete="new-password" placeholder="••••••••"
              style={focusStyle('cpwd')} onFocus={() => setFocus('cpwd')} onBlur={() => setFocus(null)} />
            {errors.confirmPassword && <p style={{ color: '#FF4D6A', fontSize: 12, marginTop: 6 }}>{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: 'linear-gradient(135deg, #00D4AA, #00B894)',
              color: '#07080C', fontWeight: 800, fontSize: 15,
              boxShadow: '0 8px 28px rgba(0,212,170,0.35)',
              border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 4,
            }}>
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Hisob yaratish
          </button>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', textAlign: 'center' }}>
            Hisobni yaratasiz — siz{' '}
            <a href="#" style={{ color: 'rgba(255,255,255,0.48)', textDecorationLine: 'underline' }}>Shartlar</a> va{' '}
            <a href="#" style={{ color: 'rgba(255,255,255,0.48)', textDecorationLine: 'underline' }}>Maxfiylik siyosati</a>ga rozilik bildirasiz.
          </p>
        </form>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: '1.25rem' }}>
          Hisobingiz bormi?{' '}
          <Link href="/login" style={{ color: '#00D4AA', fontWeight: 600, textDecoration: 'none' }}>Kirish</Link>
        </p>
      </div>
    </div>
  );
}
