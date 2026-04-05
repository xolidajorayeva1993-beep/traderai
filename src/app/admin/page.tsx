'use client'

import { useEffect, useState } from 'react'
import { Users, Brain, RefreshCw, AlertTriangle, Bell, BellOff, Server, Wifi, CreditCard, DollarSign, TrendingUp, Activity } from 'lucide-react'

interface AdminStats {
  users: { total: number; auth: number; admin: number; premium: number; free: number }
  signals: { total: number; active: number; today: number; tpHit: number; slHit: number; winRate: number }
  generatedAt: string
  error?: string
}
interface TrendData {
  days: number
  userChart:    { date: string; count: number }[]
  revenueChart: { date: string; amount: number }[]
  totals: { newUsers: number; revenue: number }
}
interface ServiceStatus { name: string; status: 'ok' | 'warn' | 'error' | 'unknown'; latency?: number; message?: string }
interface MonitoringData { checkedAt: string; overall: 'ok' | 'warn' | 'error'; services: ServiceStatus[]; recentErrors: unknown[] }
interface AlertItem { id: string; type: string; title: string; message: string; level: string; read: boolean; createdAt: string }

function StatCard({ icon: Icon, label, value, sub, iconColor, iconBg }: {
  icon: React.ElementType; label: string; value: string | number; sub: string
  iconColor: string; iconBg: string
}) {
  return (
    <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={iconColor} />
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{sub}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

const timeAgo = (iso: string) => {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)} daq`
  if (h < 24) return `${h} soat`
  return `${Math.floor(h / 24)} kun`
}

function MiniLineChart({ data, color = '#00D4AA' }: { data: number[]; color?: string }) {
  const w = 200; const h = 56
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w
    const y = h - (v / max) * (h - 6) - 3
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`g${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#g${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ServiceDot({ svc }: { svc: ServiceStatus }) {
  const cfg = {
    ok:      { color: '#00D4AA', bg: 'rgba(0,212,170,0.1)' },
    warn:    { color: '#F5B731', bg: 'rgba(245,183,49,0.1)' },
    error:   { color: '#FF4D6A', bg: 'rgba(255,77,106,0.1)' },
    unknown: { color: '#666',    bg: 'rgba(100,100,100,0.1)' },
  }
  const c = cfg[svc.status] ?? cfg.unknown
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: c.bg, border: `1px solid ${c.color}30` }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, boxShadow: svc.status === 'ok' ? `0 0 6px ${c.color}` : 'none' }} />
      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{svc.name}</span>
      {svc.latency !== undefined && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>{svc.latency}ms</span>}
      {svc.message && <span style={{ fontSize: 10, color: c.color, marginLeft: 'auto' }}>{svc.message}</span>}
    </div>
  )
}

function AlertBadge({ level }: { level: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    info:    { color: '#5B8BFF', label: 'Info' },
    warn:    { color: '#F5B731', label: 'Ogohlantirish' },
    error:   { color: '#FF4D6A', label: 'Xato' },
    success: { color: '#00D4AA', label: 'Muvaffaqiyat' },
  }
  const c = cfg[level] ?? cfg.info
  return <span style={{ fontSize: 10, fontWeight: 700, color: c.color, background: `${c.color}15`, border: `1px solid ${c.color}40`, borderRadius: 5, padding: '2px 6px' }}>{c.label}</span>
}

export default function AdminPage() {
  const [stats, setStats]           = useState<AdminStats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [trends, setTrends]         = useState<TrendData | null>(null)
  const [monitor, setMonitor]       = useState<MonitoringData | null>(null)
  const [monLoading, setMonLoading] = useState(false)
  const [alerts, setAlerts]         = useState<AlertItem[]>([])
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [trendDays, setTrendDays]   = useState(14)
  const [newAlert, setNewAlert]     = useState({ title: '', message: '', level: 'info' })
  const [showAlertForm, setShowAlertForm] = useState(false)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/stats')
      setStats(await r.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const fetchTrends = async (days: number) => {
    try {
      const r = await fetch(`/api/admin/trends?days=${days}`)
      const data = await r.json()
      if (data?.totals) setTrends(data)
    } catch { /* ignore */ }
  }

  const fetchMonitoring = async () => {
    setMonLoading(true)
    try {
      const r = await fetch('/api/admin/monitoring')
      setMonitor(await r.json())
    } catch { /* ignore */ } finally { setMonLoading(false) }
  }

  const fetchAlerts = async () => {
    try {
      const r = await fetch('/api/admin/alerts')
      const d = await r.json()
      setAlerts(d.alerts ?? [])
      setUnreadAlerts(d.unread ?? 0)
    } catch { /* ignore */ }
  }

  const markAlertRead = async (id?: string) => {
    await fetch(`/api/admin/alerts${id ? `?id=${id}` : ''}`, { method: 'PATCH' })
    fetchAlerts()
  }

  const sendAlert = async () => {
    if (!newAlert.title || !newAlert.message) return
    await fetch('/api/admin/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAlert) })
    setNewAlert({ title: '', message: '', level: 'info' })
    setShowAlertForm(false)
    fetchAlerts()
  }

  useEffect(() => {
    fetchStats()
    fetchTrends(trendDays)
    fetchAlerts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeTrendDays = (d: number) => { setTrendDays(d); fetchTrends(d) }

  const u = stats?.users
  const s = stats?.signals
  const cards = [
    { icon: Users,     label: 'Jami foydalanuvchilar',    value: u?.total ?? 0,   sub: `Admin:${u?.admin ?? 0}`,  iconColor: '#5B8BFF', iconBg: 'rgba(91,139,255,0.12)'  },
    { icon: CreditCard,label: 'Premium foydalanuvchilar', value: u?.premium ?? 0, sub: 'Obunali',              iconColor: '#F5B731', iconBg: 'rgba(245,183,49,0.12)'  },
    { icon: Brain,     label: 'AI Chat (Bepul)',          value: u?.free ?? 0,    sub: 'Free plan',             iconColor: '#9D6FFF', iconBg: 'rgba(157,111,255,0.12)' },
    { icon: DollarSign,label: 'Admin',                   value: u?.admin ?? 0,   sub: 'Admin akkauntlar',      iconColor: '#00D4AA', iconBg: 'rgba(0,212,170,0.12)'   },
  ]
  const signalCards = [
    { icon: Activity,   label: 'Jami Signallar',  value: s?.total ?? 0,                    sub: 'Barcha vaqt',      iconColor: '#5B8BFF', iconBg: 'rgba(91,139,255,0.12)'  },
    { icon: TrendingUp, label: 'Ochiq Signallar', value: s?.active ?? 0,                   sub: 'Hozir aktiv',      iconColor: '#00D4AA', iconBg: 'rgba(0,212,170,0.12)'   },
    { icon: Brain,      label: 'Win Rate',        value: `${s?.winRate ?? 0}%`,             sub: `${s?.tpHit ?? 0}TP / ${s?.slHit ?? 0}SL`, iconColor: '#9D6FFF', iconBg: 'rgba(157,111,255,0.12)' },
    { icon: CreditCard, label: 'Bugungi Signallar',value: s?.today ?? 0,                   sub: 'Oxirgi 24 soat',   iconColor: '#F5B731', iconBg: 'rgba(245,183,49,0.12)'  },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Admin Overview</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '4px 0 0' }}>
            {loading ? 'Yuklanmoqda' : stats?.error ? ` ${stats.error}` : `Yangilangan: ${stats?.generatedAt ? new Date(stats.generatedAt).toLocaleTimeString() : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchStats} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12,
          }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Yangilash
          </button>
          <button onClick={() => setShowAlertForm(v => !v)} style={{
            position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(245,183,49,0.08)', border: '1px solid rgba(245,183,49,0.25)',
            color: '#F5B731', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            <Bell size={13} /> E&apos;lon
            {unreadAlerts > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#FF4D6A', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadAlerts}</span>
            )}
          </button>
        </div>
      </div>

      {/* Alert create form */}
      {showAlertForm && (
        <div style={{ marginBottom: 16, padding: 16, borderRadius: 10, background: 'rgba(245,183,49,0.05)', border: '1px solid rgba(245,183,49,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F5B731', marginBottom: 10 }}>Yangi e&apos;lon / ogohlantirish</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={newAlert.title} onChange={e => setNewAlert(v => ({ ...v, title: e.target.value }))}
              placeholder="Sarlavha" style={{ flex: '1 1 160px', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12 }} />
            <input value={newAlert.message} onChange={e => setNewAlert(v => ({ ...v, message: e.target.value }))}
              placeholder="Xabar matni" style={{ flex: '2 1 240px', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12 }} />
            <select value={newAlert.level} onChange={e => setNewAlert(v => ({ ...v, level: e.target.value }))}
              style={{ padding: '7px 10px', borderRadius: 8, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12 }}>
              <option value="info">Info</option>
              <option value="warn">Ogohlantirish</option>
              <option value="error">Xato</option>
              <option value="success">Muvaffaqiyat</option>
            </select>
            <button onClick={sendAlert} style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(245,183,49,0.15)', border: '1px solid rgba(245,183,49,0.4)', color: '#F5B731', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Yuborish</button>
          </div>
        </div>
      )}

      {/* Stat cards — Users */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        {cards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Stat cards — Signals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {signalCards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Trend charts */}
      <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Trend Ko&apos;rsatkichlar</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {([7, 14, 30] as const).map(d => (
              <button key={d} onClick={() => changeTrendDays(d)} style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                background: trendDays === d ? 'rgba(91,139,255,0.15)' : 'transparent',
                color: trendDays === d ? '#5B8BFF' : 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer',
              }}>{d} kun</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Yangi foydalanuvchilar</div>
            <MiniLineChart data={(trends?.userChart ?? []).map(d => d.count)} color="#5B8BFF" />
            <div style={{ fontSize: 20, fontWeight: 800, color: '#5B8BFF', marginTop: 4 }}>{trends?.totals?.newUsers ?? ''}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>so&apos;nggi {trendDays} kun</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Daromad (UZS)</div>
            <MiniLineChart data={(trends?.revenueChart ?? []).map(d => d.amount)} color="#F5B731" />
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F5B731', marginTop: 4 }}>{trends ? (trends.totals?.revenue ?? 0) / 1_000_000 > 0 ? ((trends.totals.revenue / 1_000_000).toFixed(1) + 'M') : '0M' : ''}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>so&apos;nggi {trendDays} kun</div>
          </div>
        </div>
      </div>

      {/* Users breakdown + Monitoring + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Users breakdown */}
        <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Foydalanuvchi taqsimoti</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Admin',   value: u?.admin ?? 0,   color: '#9D6FFF', total: u?.total ?? 1 },
              { label: 'Premium', value: u?.premium ?? 0, color: '#F5B731', total: u?.total ?? 1 },
              { label: 'Bepul',   value: u?.free ?? 0,    color: '#5B8BFF', total: u?.total ?? 1 },
            ].map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: item.color, width: `${item.total > 0 ? Math.round((item.value / item.total) * 100) : 0}%`, transition: 'width .8s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System monitoring */}
        <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={14} color="#5B8BFF" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Tizim Holati</span>
            </div>
            <button onClick={fetchMonitoring} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>
              {monLoading ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Tekshir...</> : <><Wifi size={11} /> Tekshirish</>}
            </button>
          </div>
          {!monitor ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              <Server size={28} color="rgba(255,255,255,0.08)" style={{ display: 'block', margin: '0 auto 8px' }} />
              &quot;Tekshirish&quot; tugmasini bosing
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {monitor.services.map((svc, i) => <ServiceDot key={i} svc={svc} />)}
            </div>
          )}
        </div>

        {/* Alerts panel */}
        <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color="#F5B731" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Ogohlantirishlar</span>
              {unreadAlerts > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#FF4D6A', background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: 5, padding: '1px 7px' }}>{unreadAlerts} yangi</span>}
            </div>
            {unreadAlerts > 0 && (
              <button onClick={() => markAlertRead()} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>
                <BellOff size={11} /> Barchasini o&apos;qi
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              <Bell size={28} color="rgba(255,255,255,0.08)" style={{ display: 'block', margin: '0 auto 8px' }} />
              Hozircha ogohlantirish yo&apos;q
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {alerts.map(a => (
                <div key={a.id} onClick={() => !a.read && markAlertRead(a.id)} style={{
                  padding: '8px 10px', borderRadius: 8, cursor: a.read ? 'default' : 'pointer',
                  background: a.read ? 'rgba(255,255,255,0.02)' : 'rgba(245,183,49,0.04)',
                  border: `1px solid ${a.read ? 'rgba(255,255,255,0.05)' : 'rgba(245,183,49,0.15)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: a.read ? 'rgba(255,255,255,0.5)' : '#fff' }}>{a.title}</span>
                    <AlertBadge level={a.level} />
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{a.message}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>{timeAgo(a.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: ' AI Sozlamalar',    href: '/admin/ai',       color: '#9D6FFF' },
          { label: ' Foydalanuvchilar', href: '/admin/users',    color: '#5B8BFF' },
          { label: ' Tarif / Obuna',    href: '/admin/plans',    color: '#F5B731' },
          { label: ' Sozlamalar',       href: '/admin/settings', color: '#00D4AA' },
        ].map(a => (
          <a key={a.label} href={a.href} style={{
            display: 'block', textAlign: 'center', padding: '12px 8px', borderRadius: 10,
            fontSize: 13, fontWeight: 600, color: a.color, textDecoration: 'none',
            background: `${a.color}10`, border: `1px solid ${a.color}30`,
          }}>{a.label}</a>
        ))}
      </div>
    </div>
  )
}
