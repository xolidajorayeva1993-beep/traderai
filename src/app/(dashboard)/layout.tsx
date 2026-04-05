'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Activity,
  LogOut, Menu, X, Shield,
  ChevronRight, MessageSquare, User, CreditCard,
} from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import { logOut } from '@/lib/firebase/auth';

const NAV_ITEMS = [
  { href: '/dashboard',  icon: Activity,      label: 'Dashboard',   color: '#00D4AA' },
  { href: '/chat',       icon: MessageSquare, label: 'FATH AI',     color: '#9D6FFF' },
  { href: '/billing',    icon: CreditCard,    label: 'Billing',     color: '#F5B731' },
  { href: '/profile',    icon: User,          label: 'Profil',      color: '#9D6FFF' },
];

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = useAuth((s) => s.user);

  const handleLogout = async () => {
    await logOut();
    router.push('/');
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:z-auto`}
        style={{
          background: 'linear-gradient(180deg, #0D0F18 0%, #0A0C14 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 0 20px rgba(0,212,170,0.35)', flexShrink: 0,
              }}>
                <Image src="/logo2.png" alt="FATH AI" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1 }}>FATH AI</p>
                <p style={{ fontSize: 10, color: '#00D4AA', fontWeight: 600, letterSpacing: '0.08em', marginTop: 2 }}>FATH AI POWERED</p>
              </div>
            </Link>
            <button onClick={onClose} className="lg:hidden" style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map(({ href, icon: Icon, label, color }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 12, textDecoration: 'none',
                  transition: 'all 0.15s',
                  background: isActive ? `${color}14` : 'transparent',
                  border: `1px solid ${isActive ? `${color}30` : 'transparent'}`,
                  color: isActive ? color : 'rgba(255,255,255,0.45)',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? `${color}20` : 'rgba(255,255,255,0.04)',
                }}>
                  <Icon size={16} color={isActive ? color : 'rgba(255,255,255,0.4)'} />
                </div>
                <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400 }}>{label}</span>
                {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto', color }} />}
              </Link>
            );
          })}

          {user?.role === 'admin' && (
            <Link href="/admin" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 12, textDecoration: 'none', color: '#F5B731',
              background: 'rgba(245,183,49,0.06)', border: '1px solid rgba(245,183,49,0.15)',
              marginTop: 8,
            }}>
              <Shield size={16} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Admin Panel</span>
            </Link>
          )}
        </nav>

        {/* Upgrade banner */}
        {user?.plan === 'free' && (
          <div style={{ padding: '0 12px 12px' }}>
            <Link href="/pricing" style={{
              display: 'block', padding: '14px', borderRadius: 14, textDecoration: 'none',
              background: 'linear-gradient(135deg, rgba(91,139,255,0.15), rgba(157,111,255,0.15))',
              border: '1px solid rgba(91,139,255,0.25)',
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>⚡ Pro ga o'ting</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Cheksiz signallar va tahlil</p>
              <div style={{
                background: 'linear-gradient(135deg, #5B8BFF, #9D6FFF)',
                borderRadius: 8, padding: '6px 12px', display: 'inline-block',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>Upgrade →</div>
            </Link>
          </div>
        )}

        {/* User + logout */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: '0 0 12px rgba(0,212,170,0.3)',
            }}>
              {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.displayName ?? 'Trader'}
              </p>
              <p style={{ fontSize: 11, color: '#00D4AA', fontWeight: 500, textTransform: 'capitalize' }}>
                {user?.plan ?? 'free'} plan
              </p>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,77,106,0.06)', border: '1px solid rgba(255,77,106,0.15)',
            color: '#FF4D6A', fontSize: 12, fontWeight: 500,
          }}>
            <LogOut size={13} />
            Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const user = useAuth((s) => s.user);
  return (
    <header style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(10,12,20,0.95)', backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      <button onClick={onMenuClick} className="lg:hidden" style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'rgba(255,255,255,0.5)', padding: 4,
      }}>
        <Menu size={20} />
      </button>

      <div style={{ flex: 1 }} />

      {/* Live indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginRight: 16,
        padding: '5px 12px', borderRadius: 20,
        background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4AA', display: 'block', boxShadow: '0 0 6px #00D4AA' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#00D4AA', letterSpacing: '0.05em' }}>LIVE</span>
      </div>

      {/* Bell */}
      <button style={{
        position: 'relative', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
        padding: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', marginRight: 8,
        display: 'flex', alignItems: 'center',
      }}>
        <MessageSquare size={16} />
      </button>

      {/* Avatar */}
      <Link href="/profile" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
          boxShadow: '0 0 10px rgba(0,212,170,0.25)',
        }}>
          {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
        </div>
      </Link>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user        = useAuth((s) => s.user);
  const loading     = useAuth((s) => s.loading);
  const initialized = useAuth((s) => s.initialized);
  const refreshUser = useAuth((s) => s.refreshUser);
  const router = useRouter();

  // Refresh user profile from Firestore on mount to pick up admin changes
  useEffect(() => {
    if (initialized && user) {
      refreshUser();
    }
  }, [initialized]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialized && !loading && !user) {
      router.replace('/login');
    }
  }, [initialized, loading, user, router]);

  // Show loading spinner while Firebase resolves auth state
  if (!initialized || loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#07080C', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid rgba(0,212,170,0.2)',
          borderTopColor: '#00D4AA',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Yuklanmoqda...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
