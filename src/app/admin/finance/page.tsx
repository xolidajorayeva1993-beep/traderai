'use client'
// ============================================================
// /admin/finance — Moliyaviy Ko'rsatkichlar
// Daromad, to'lovlar tarixi, obunalar, qaytarishlar
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, TrendingUp, Users, CreditCard, RefreshCw, Download, BarChart2, Undo2, Check, X } from 'lucide-react'

interface AnalyticsData {
  mrr: number
  arpu: number
  ltv: number
  churnRate: number
  activeSubscribers: number
  totalRevenue: number
  avgLifeMonths: number
  monthlyChart: { month: string; revenue: number; newSubs: number; churned: number }[]
  planDistribution: { plan: string; count: number; revenue: number }[]
}

interface PaymentRecord {
  id:        string
  userId:    string
  email?:    string
  plan:      string
  amount:    number
  currency:  string
  status:    'success' | 'failed' | 'refunded' | 'pending'
  provider?: string
  createdAt: string
}

interface RefundRequest {
  id: string
  userId: string
  userEmail: string
  userName: string
  subscriptionId: string
  planName: string
  amount: number
  currency: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote?: string
  requestedAt: string
  processedAt?: string
}

interface FinanceSummary {
  totalRevenue:     number
  monthRevenue:     number
  activeSubscribers: number
  totalPayments:    number
  refunds:          number
  avgRevPerUser:    number
}

function MetricCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType
}) {
  return (
    <div style={{ background: '#0d1117', border: `1px solid ${color}20`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
      </div>
      <p style={{ fontSize: 26, fontWeight: 900, color }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

const statusStyle: Record<string, { color: string; label: string }> = {
  success:  { color: '#00D4AA', label: 'Muvaffaqiyatli' },
  failed:   { color: '#FF4D6A', label: 'Xato' },
  refunded: { color: '#F5B731', label: 'Qaytarildi' },
  pending:  { color: '#6b7280', label: 'Kutilmoqda' },
}

export default function AdminFinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'payments' | 'subscriptions' | 'refunds'>('overview')
  const [refunds, setRefunds] = useState<RefundRequest[]>([])
  const [refundStatus, setRefundStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [refundMsg, setRefundMsg] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [newRefund, setNewRefund] = useState({ userId: '', subscriptionId: '', amount: '', reason: '' })
  const [addingRefund, setAddingRefund] = useState(false)

  const loadRefunds = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/refunds?status=${refundStatus}&limit=50`)
      const data = await res.json() as { refunds?: RefundRequest[] }
      setRefunds(data.refunds ?? [])
    } catch {}
  }, [refundStatus])

  const handleRefundAction = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id); setRefundMsg('')
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, adminNote }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.error) throw new Error(data.error)
      setRefundMsg(`✓ Refund ${status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`)
      setAdminNote('')
      await loadRefunds()
    } catch (e) {
      setRefundMsg(`Xato: ${e instanceof Error ? e.message : e}`)
    } finally {
      setProcessingId(null)
    }
  }

  const createManualRefund = async () => {
    setAddingRefund(true); setRefundMsg('')
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRefund, amount: parseFloat(newRefund.amount), adminInitiated: true }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.error) throw new Error(data.error)
      setRefundMsg('✓ Refund so\'rovi yaratildi')
      setNewRefund({ userId: '', subscriptionId: '', amount: '', reason: '' })
      await loadRefunds()
    } catch (e) {
      setRefundMsg(`Xato: ${e instanceof Error ? e.message : e}`)
    } finally {
      setAddingRefund(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, pRes, aRes] = await Promise.all([
        fetch('/api/admin/finance/summary'),
        fetch('/api/admin/finance/payments?limit=50'),
        fetch('/api/admin/subscriptions/analytics?months=6'),
      ])
      const [sData, pData, aData] = await Promise.all([sRes.json(), pRes.json(), aRes.json()]) as [
        { summary?: FinanceSummary },
        { payments?: PaymentRecord[] },
        AnalyticsData,
      ]
      setSummary(sData.summary ?? null)
      setPayments(pData.payments ?? [])
      setAnalytics(aData ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'refunds') loadRefunds() }, [tab, loadRefunds])

  const exportCsv = () => {
    const headers = ['ID', 'Email', 'Plan', 'Summa', 'Holat', 'Sana']
    const rows    = payments.map(p => [p.id, p.email ?? '', p.plan, `$${p.amount}`, p.status, p.createdAt])
    const csv     = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob    = new Blob([csv], { type: 'text/csv' })
    const url     = URL.createObjectURL(blob)
    const a       = document.createElement('a')
    a.href = url; a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const s = summary

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Moliyaviy Ko'rsatkichlar</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Daromad, to'lovlar va obuna tahlili</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '8px 14px', borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)', color: '#00D4AA', fontSize: 12, fontWeight: 700 }}>
            <Download size={13} /> CSV export
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <MetricCard label="Umumiy daromad" value={`$${s?.totalRevenue?.toLocaleString() ?? '—'}`} sub="Barcha vaqt uchun" color="#00D4AA" icon={DollarSign} />
        <MetricCard label="Bu oy" value={`$${s?.monthRevenue?.toLocaleString() ?? '—'}`} sub="Joriy oy" color="#5B8BFF" icon={TrendingUp} />
        <MetricCard label="Faol obunalar" value={String(s?.activeSubscribers ?? '—')} sub="Premium + Pro" color="#F5B731" icon={Users} />
        <MetricCard label="Jami to'lovlar" value={String(s?.totalPayments ?? '—')} sub={`${s?.refunds ?? 0} qaytarildi`} color="#9D6FFF" icon={CreditCard} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {([['overview', '📊 Umumiy'], ['payments', '💳 To\'lovlar'], ['subscriptions', '🔄 Obunalar'], ['refunds', '↩ Refundlar']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none',
            color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
            borderBottom: tab === t ? '2px solid #00D4AA' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* Payments table */}
      {(tab === 'payments' || tab === 'overview') && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>To'lovlar Tarixi</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                {['Foydalanuvchi', 'Tarif', 'Summa', 'Holat', 'Sana'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Yuklanmoqda...</td></tr>
              )}
              {!loading && payments.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>To'lovlar tarixi mavjud emas</td></tr>
              )}
              {payments.slice(0, 30).map(p => {
                const st = statusStyle[p.status] ?? statusStyle.pending
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{p.email ?? p.userId.slice(0, 12) + '...'}</td>
                    <td style={{ padding: '11px 8px', fontSize: 12 }}>
                      <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: 'rgba(91,139,255,0.1)', color: '#5B8BFF' }}>{p.plan}</span>
                    </td>
                    <td style={{ padding: '11px 8px', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>${p.amount}</td>
                    <td style={{ padding: '11px 8px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: `${st.color}15`, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'subscriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {[
              { label: 'MRR', value: analytics ? `$${analytics.mrr.toLocaleString()}` : '—', sub: 'Oylik takroriy daromad', color: '#00D4AA' },
              { label: 'ARPU', value: analytics ? `$${analytics.arpu}` : '—', sub: 'Foydalanuvchi boshiga', color: '#5B8BFF' },
              { label: 'LTV', value: analytics ? `$${analytics.ltv.toLocaleString()}` : '—', sub: `~${analytics?.avgLifeMonths ?? 0} oy`, color: '#9D6FFF' },
              { label: 'Churn Rate', value: analytics ? `${analytics.churnRate}%` : '—', sub: 'Oylik bekor qilish', color: analytics && analytics.churnRate > 5 ? '#FF4D6A' : '#F5B731' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background: '#0d1117', border: `1px solid ${color}20`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Monthly chart */}
          {analytics?.monthlyChart && analytics.monthlyChart.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}><BarChart2 size={15} /> Oylik Obunalar</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
                {(() => {
                  const maxR = Math.max(...analytics.monthlyChart.map(m => m.revenue), 1)
                  return analytics.monthlyChart.map(m => (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, color: '#00D4AA', fontWeight: 700 }}>${m.revenue > 0 ? (m.revenue >= 1000 ? (m.revenue / 1000).toFixed(1) + 'k' : m.revenue) : ''}</div>
                      <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(to top, #00D4AA, #5B8BFF)', minHeight: 4, height: Math.max(4, (m.revenue / maxR) * 80) }} />
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', whiteSpace: 'nowrap' }}>{m.month}</div>
                    </div>
                  ))
                })()}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                {analytics.monthlyChart.map(m => (
                  <div key={m.month} style={{ flex: 1, textAlign: 'center' }}>
                    {m.newSubs > 0 && <span style={{ fontSize: 10, color: '#00D4AA' }}>+{m.newSubs}</span>}
                    {m.churned > 0 && <span style={{ fontSize: 10, color: '#FF4D6A', marginLeft: 4 }}>-{m.churned}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan distribution */}
          {analytics?.planDistribution && analytics.planDistribution.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Tarif taqsimoti</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analytics.planDistribution.map(({ plan, count, revenue }) => {
                  const planColors: Record<string, string> = { free: '#6b7280', premium: '#F5B731', pro: '#9D6FFF' }
                  const c = planColors[plan] ?? '#5B8BFF'
                  const total = analytics.planDistribution.reduce((sum, p) => sum + p.count, 0)
                  const pct   = total > 0 ? Math.round(count / total * 100) : 0
                  return (
                    <div key={plan}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: c, fontWeight: 700, textTransform: 'capitalize' }}>{plan}</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{count} ta · ${revenue.toLocaleString()}</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 5 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 5, minWidth: pct > 0 ? 8 : 0 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* CSV export */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={exportCsv}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)', color: '#00D4AA', fontSize: 12, fontWeight: 700 }}
            >
              <Download size={13} /> To'lovlarni CSV export
            </button>
          </div>
        </div>
      )}

      {/* Refunds tab */}
      {tab === 'refunds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Manual refund form */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,183,49,0.15)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F5B731', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Undo2 size={14} /> Admin tomonidan Refund yaratish
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <input placeholder="User ID" value={newRefund.userId} onChange={e => setNewRefund(p => ({ ...p, userId: e.target.value }))}
                style={{ padding: '9px 12px', borderRadius: 8, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, outline: 'none' }} />
              <input placeholder="Subscription ID" value={newRefund.subscriptionId} onChange={e => setNewRefund(p => ({ ...p, subscriptionId: e.target.value }))}
                style={{ padding: '9px 12px', borderRadius: 8, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, outline: 'none' }} />
              <input placeholder="Summa ($)" type="number" value={newRefund.amount} onChange={e => setNewRefund(p => ({ ...p, amount: e.target.value }))}
                style={{ padding: '9px 12px', borderRadius: 8, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, outline: 'none' }} />
              <input placeholder="Sabab" value={newRefund.reason} onChange={e => setNewRefund(p => ({ ...p, reason: e.target.value }))}
                style={{ padding: '9px 12px', borderRadius: 8, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, outline: 'none' }} />
            </div>
            <button onClick={createManualRefund} disabled={addingRefund || !newRefund.userId || !newRefund.subscriptionId || !newRefund.amount || !newRefund.reason}
              style={{ marginTop: 10, padding: '8px 20px', borderRadius: 8, background: 'rgba(245,183,49,0.15)', border: '1px solid rgba(245,183,49,0.3)', color: '#F5B731', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {addingRefund ? '...' : '+ Refund yaratish'}
            </button>
          </div>

          {/* Filter row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                <button key={s} onClick={() => setRefundStatus(s)}
                  style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: refundStatus === s ? '#5B8BFF' : 'rgba(255,255,255,0.05)',
                    color: refundStatus === s ? '#fff' : '#6b7280',
                  }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
              ))}
            </div>
            {refundMsg && <span style={{ fontSize: 12, color: refundMsg.startsWith('✓') ? '#00D4AA' : '#FF4D6A' }}>{refundMsg}</span>}
          </div>

          {/* Refund list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {refunds.length === 0 && (
              <div style={{ textAlign: 'center', color: '#4b5563', padding: 30, fontSize: 13 }}>Refund so'rovlari yo'q</div>
            )}
            {refunds.map(r => (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                      {r.userEmail || r.userName || r.userId.slice(0, 14) + '...'}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                      Plan: <span style={{ color: '#5B8BFF' }}>{r.planName || r.subscriptionId.slice(0, 10) + '...'}</span>
                      {' · '}<span style={{ color: '#F5B731', fontWeight: 700 }}>${r.amount} {r.currency}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Sabab: {r.reason}</div>
                    {r.adminNote && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Admin izohi: {r.adminNote}</div>}
                    <div style={{ fontSize: 10, color: '#4b5563', marginTop: 6 }}>
                      {r.requestedAt ? new Date(r.requestedAt).toLocaleString('uz-UZ') : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                      background: r.status === 'pending' ? 'rgba(245,183,49,0.15)' : r.status === 'approved' ? 'rgba(0,212,170,0.15)' : 'rgba(255,77,106,0.15)',
                      color: r.status === 'pending' ? '#F5B731' : r.status === 'approved' ? '#00D4AA' : '#FF4D6A',
                    }}>{r.status === 'pending' ? 'Kutilmoqda' : r.status === 'approved' ? 'Tasdiqlandi' : 'Rad etildi'}</span>
                    {r.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
                        <input placeholder="Admin izohi..." value={adminNote} onChange={e => setAdminNote(e.target.value)}
                          style={{ padding: '5px 9px', borderRadius: 6, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 11, outline: 'none', width: 160 }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleRefundAction(r.id, 'approved')} disabled={processingId === r.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: '#00D4AA', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            <Check size={11} /> Tasdiqlash
                          </button>
                          <button onClick={() => handleRefundAction(r.id, 'rejected')} disabled={processingId === r.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', color: '#FF4D6A', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            <X size={11} /> Rad etish
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
