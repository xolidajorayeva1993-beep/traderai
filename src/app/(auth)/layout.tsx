// Shared auth layout
import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#07080C' }}
    >
      {/* Background glows */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,170,0.10) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,139,255,0.08) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Nav */}
      <header className="relative flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden" style={{ boxShadow: '0 0 16px rgba(0,212,170,0.3)' }}>
            <Image src="/logo2.png" alt="FATH AI" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">FATH AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(0,212,170,0.1)', color: '#00D4AA', border: '1px solid rgba(0,212,170,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] inline-block" />
            FATH AI Faol
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>

      <footer className="relative py-4 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        &copy; {new Date().getFullYear()} FATH AI. Barcha huquqlar himoyalangan.
      </footer>
    </div>
  );
}
