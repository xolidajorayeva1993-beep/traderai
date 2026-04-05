'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPassword } from '@/lib/firebase/auth';

const schema = z.object({
  email: z.string().email('To\'g\'ri email manzil kiriting'),
});

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await resetPassword(data.email);
      setSent(true);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('user-not-found'))  setError('Bu email bilan foydalanuvchi topilmadi.');
      else if (msg.includes('too-many'))   setError('Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.');
      else setError('Xato yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
  }

  return (
    <div className="min-h-screen bg-[#07080C] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg overflow-hidden">
              <img src="/logo2.png" alt="FATH AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span className="text-white font-bold text-xl">FATH AI</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Parolni tiklash</h1>
          <p className="text-white/40 text-sm mt-2">
            Email manzilingizni kiriting, tiklash havolasini yuboramiz
          </p>
        </div>

        <div className="bg-[#0D0F16] border border-white/8 rounded-2xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#00D4AA]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📧</span>
              </div>
              <h2 className="text-white text-lg font-semibold mb-2">Xat yuborildi!</h2>
              <p className="text-white/50 text-sm mb-6">
                <strong className="text-white">{getValues('email')}</strong> manziliga parolni tiklash
                havolasi yuborildi. Inbox yoki spam papkasini tekshiring.
              </p>
              <Link
                href="/login"
                className="inline-block w-full py-3 rounded-xl bg-[#00D4AA] text-[#07080C] font-bold text-center transition-opacity hover:opacity-90"
              >
                Kirish sahifasiga qaytish
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              {error && (
                <div className="bg-[#FF4D6A]/10 border border-[#FF4D6A]/30 rounded-xl px-4 py-3 text-[#FF4D6A] text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Email manzil
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="email@example.com"
                  autoComplete="email"
                  className="input-dark w-full px-4 py-3 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00D4AA] focus:ring-1 focus:ring-[#00D4AA]/30"
                />
                {errors.email && (
                  <p className="text-[#FF4D6A] text-xs mt-2">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-[#00D4AA] text-[#07080C] font-bold text-sm transition-opacity disabled:opacity-60 hover:opacity-90"
              >
                {isSubmitting ? 'Yuborilmoqda…' : 'Tiklash havolasini yuborish'}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-[#00D4AA] text-sm hover:underline">
                  ← Kirish sahifasiga qaytish
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
