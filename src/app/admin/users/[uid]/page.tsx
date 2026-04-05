'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, User, TrendingUp, Shield, Calendar, Save, Ban, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface UserDetail {
  uid: string; email: string; displayName: string; photoURL: string | null
  emailVerified: boolean; disabled: boolean; createdAt: string; lastSignIn: string
  role: string; plan: string; planExpiresAt: string | null; telegramId: string | null
  limits: Record<string, unknown>; notes: string
  stats: { total: number; tpCount: number; slCount: number; winRate: number }
  recentSignals: Array<{ id: string; symbol: string; direction: string; status: string; confidence: number; createdAt: string }>
  subscriptions: Array<{ id: string; planId: string; amount: number; paidAt: string; status: string }>
}

const ROLE_OPTIONS = ['free', 'admin', 'banned']

const statusColor: Record<string, string> = {
  open: '#5B8BFF', tp1: '#00D4AA', tp2: '#00D4AA', tp3: '#00D4AA', sl: '#FF4D6A',
}
const dirColor = (d: string) => d?.includes('BUY') ? '#00D4AA' : '#FF4D6A'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default function UserDetailPage() {
  const { uid } = useParams() as { uid: string }
  const router = useRouter()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editRole, setEditRole] = useState('')
  const [editPlan, setEditPlan] = useState('')
  const [editPlanExpiry, setEditPlanExpiry] = useState('') // YYYY-MM-DD
  const [editNotes, setEditNotes] = useState('')
  const [editLimits, setEditLimits] = useState({
    dailySignals: 0, aiChatLimit: 0,
  })
  const [plans, setPlans] = useState<Array<{ name: string; displayName: string; limits?: Record<string, unknown> }>>([])

  const fetchUser = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/users/${uid}`)
      const d = await r.json()
      setUser({ ...d, recentSignals: d.recentSignals ?? [], subscriptions: d.subscriptions ?? [], stats: d.stats ?? { total: 0, tpCount: 0, slCount: 0, winRate: 0 } })
      setEditRole(d.role ?? 'free')
      setEditPlan(d.plan ?? 'free')
      setEditPlanExpiry(d.planExpiresAt ? new Date(d.planExpiresAt).toISOString().slice(0, 10) : '')
      setEditNotes(d.notes ?? '')
      setEditLimits({
        dailySignals: d.limits?.dailySignals ?? 0,
        aiChatLimit: d.limits?.aiChatLimit ?? 0,
      })
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => {
    fetch('/api/plans').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : (Array.isArray(d?.plans) ? d.plans : [])
      if (list.length > 0) setPlans(list)
    }).catch(() => {})
  }, [])

  useEffect(() => { if (uid) fetchUser() }, [uid])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/admin/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            role: editRole,
            plan: editPlan,
            planActivatedAt: editPlan !== (user?.plan ?? 'free') ? Date.now() : undefined,
            planExpiresAt: editPlanExpiry ? new Date(editPlanExpiry).getTime() : undefined,
            adminNotes: editNotes,
            limits: editLimits,
          }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      fetchUser()
    } finally { setSaving(false) }
  }

  const handleDisable = async () => {
    if (!user) return
    await fetch(`/api/admin/users/${uid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: !user.disabled }),
    })
    fetchUser()
  }

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Yuklanmoqda…</div>
  )
  if (!user) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#FF4D6A', fontSize: 14 }}>Foydalanuvchi topilmadi</div>
  )

  const timeAgo = (iso: string) => {
    if (!iso) return '—'
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    if (h < 1) return `${Math.floor(diff / 60000)} daq`
    if (h < 24) return `${h} soat`
    return `${Math.floor(h / 24)} kun`
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/users" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={14} /> Orqaga
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
        <span style={{ fontSize: 13, color: '#fff' }}>{user.email}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={handleDisable} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: user.disabled ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)', border: user.disabled ? '1px solid rgba(0,212,170,0.3)' : '1px solid rgba(255,77,106,0.3)', color: user.disabled ? '#00D4AA' : '#FF4D6A', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {user.disabled ? <CheckCircle size={13} /> : <Ban size={13} />} {user.disabled ? 'Faollashtirish' : 'Bloklash'}
          </button>
          <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, background: saved ? 'rgba(0,212,170,0.12)' : 'rgba(91,139,255,0.12)', border: saved ? '1px solid rgba(0,212,170,0.35)' : '1px solid rgba(91,139,255,0.35)', color: saved ? '#00D4AA' : '#5B8BFF', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            <Save size={13} /> {saving ? 'Saqlanmoqda…' : saved ? 'Saqlandi ✓' : 'Saqlash'}
          </button>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
        {/* Left column — user info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Profile card */}
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(91,139,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={24} color="#5B8BFF" />
                </div>
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{user.displayName || user.email}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{user.email}</div>
                {user.disabled && <span style={{ fontSize: 10, color: '#FF4D6A', background: 'rgba(255,77,106,0.1)', padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(255,77,106,0.3)', fontWeight: 700 }}>BLOKLANGAN</span>}
              </div>
            </div>
            <InfoRow label="UID" value={<span style={{ fontFamily: 'monospace', fontSize: 10 }}>{(user.uid ?? '').slice(0, 16)}…</span>} />
            <InfoRow label="Email tasdiqlangan" value={user.emailVerified ? '✅ Ha' : '❌ Yo\'q'} />
            <InfoRow label="Telefon" value={user.telegramId ?? '—'} />
            <InfoRow label="Ro'yxatdan o'tgan" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'} />
            <InfoRow label="So'nggi kirish" value={timeAgo(user.lastSignIn)} />
          </div>

          {/* Stat cards */}
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Signal Statistikasi</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {[
                { label: 'Jami', value: user.stats.total, color: '#fff' },
                { label: 'Win Rate', value: `${user.stats.winRate}%`, color: '#00D4AA' },
                { label: 'TP Hit', value: user.stats.tpCount, color: '#00D4AA' },
                { label: 'SL Hit', value: user.stats.slCount, color: '#FF4D6A' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — edit + recent */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Role + Plan */}
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="#9D6FFF" /> Rol va Tarif Boshqaruvi
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>Rol</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12 }}>
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>Tarif</label>
                <select value={editPlan} onChange={e => {
                  const selectedName = e.target.value
                  setEditPlan(selectedName)
                  const found = plans.find(p => p.name === selectedName)
                  if (found?.limits) {
                    setEditLimits({
                      dailySignals: (found.limits.dailySignals as number) ?? 0,
                      aiChatLimit: (found.limits.aiChatLimit as number) ?? 0,
                    })
                  }
                }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12 }}>
                  {plans.length > 0
                    ? plans.map(p => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)
                    : <option value={editPlan}>{editPlan}</option>
                  }
                </select>
              </div>
            </div>

            {/* Plan expiry date */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>Tarif tugash sanasi</label>
              <input
                type="date"
                value={editPlanExpiry}
                onChange={e => setEditPlanExpiry(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Individual Limitlar</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>Kunlik signal (0 = cheksiz)</label>
                <input type="number" min={0} value={editLimits.dailySignals} onChange={e => setEditLimits(v => ({ ...v, dailySignals: +e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>AI chat so&apos;rovlar (0 = cheksiz)</label>
                <input type="number" min={0} value={editLimits.aiChatLimit} onChange={e => setEditLimits(v => ({ ...v, aiChatLimit: +e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Admin notes */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>Admin izohi</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Bu foydalanuvchi haqida izoh..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Recent signals */}
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} color="#00D4AA" /> So&apos;nggi Signallar
            </div>
            {(user.recentSignals?.length ?? 0) === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Signal topilmadi</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(user.recentSignals ?? []).slice(0, 8).map(sig => (
                  <div key={sig.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'monospace', minWidth: 80 }}>{sig.symbol}</span>
                    <span style={{ fontSize: 11, color: dirColor(sig.direction), fontWeight: 700 }}>{sig.direction}</span>
                    <span style={{ fontSize: 10, color: statusColor[sig.status] ?? '#666', background: `${statusColor[sig.status] ?? '#666'}15`, padding: '2px 7px', borderRadius: 5 }}>{sig.status}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{timeAgo(sig.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subscription history */}
          {(user.subscriptions?.length ?? 0) > 0 && (
            <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color="#F5B731" /> To&apos;lov Tarixi
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {user.subscriptions.map(sub => (
                  <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'rgba(245,183,49,0.04)', border: '1px solid rgba(245,183,49,0.12)' }}>
                    <span style={{ fontSize: 12, color: '#F5B731', fontWeight: 600 }}>{sub.planId}</span>
                    <span style={{ fontSize: 12, color: '#fff' }}>{(sub.amount / 1000000).toFixed(1)}M UZS</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{sub.paidAt ? new Date(sub.paidAt).toLocaleDateString() : '—'}</span>
                    <span style={{ fontSize: 10, color: sub.status === 'active' ? '#00D4AA' : 'rgba(255,255,255,0.4)' }}>{sub.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
