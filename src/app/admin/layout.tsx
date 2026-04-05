'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Activity, Users, Brain, Settings,
  BarChart3, Menu, X, LogOut, ChevronRight,
  CreditCard, DollarSign, FileBarChart2,
} from 'lucide-react';
import { logOut } from '@/lib/firebase/auth';

const ADMIN_NAV = [
  { href: '/admin',          icon: BarChart3,    label: 'Overview' },
  { href: '/admin/users',    icon: Users,         label: 'Foydalanuvchilar' },
  { href: '/admin/ai',       icon: Brain,         label: 'AI Sozlamalar' },
  { href: '/admin/prompts',  icon: Activity,      label: 'Promptlar' },
  { href: '/admin/plans',    icon: CreditCard,    label: 'Tarif / Obuna' },
  { href: '/admin/finance',  icon: DollarSign,    label: 'Moliya' },
  { href: '/admin/reports',  icon: FileBarChart2, label: 'Hisobotlar' },
  { href: '/admin/settings', icon: Settings,      label: 'Sozlamalar' },
];

function AdminSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed left-0 top-0 h-full w-60 z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:z-auto`}
        style={{ background: '#111827', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo + badge */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg overflow-hidden">
                <Image src="/logo2.png" alt="FATH AI" width={28} height={28} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span className="text-white font-bold">FATH AI</span>
            </div>
            <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              ADMIN
            </span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {ADMIN_NAV.map(({ href, icon: Icon, label }) => {
            const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Back to site + logout */}
        <div className="p-4 border-t border-white/5 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">
            <BarChart3 className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <button
            onClick={async () => { await logOut(); router.push('/'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D1117' }}>
      <AdminSidebar isOpen={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header
          className="h-14 flex items-center px-4 lg:px-6 border-b border-white/5 shrink-0"
          style={{ background: '#111827' }}
        >
          <button onClick={() => setOpen(true)} className="lg:hidden text-slate-400 hover:text-white mr-3">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">
            Admin Panel
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
