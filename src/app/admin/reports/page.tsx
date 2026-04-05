'use client'
// ============================================================
// /admin/reports — Kunlik/Haftalik/Oylik Signal Hisobotlari
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { BarChart2, TrendingUp, TrendingDown, RefreshCw, Download, Calendar, FileText } from 'lucide-react'

interface ReportData {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  generatedAt: string
  totalSignals: number
  tpCount: number
  slCount: number
  expiredCount: number
  winRate: number
  profitFactor: number
  avgRR: number
  avgConfidence: number
  topPairs: { pair: string; signals: number; winRate: number }[]
  buyCount: number
  sellCount: number
  forexCount: number
  cryptoCount: number
  tfBreakdown: { tf: string; count: number; winRate: number }[]
  newUsers: number
  revenue: number
  newSubscriptions: number
}

const REPORT_TYPES = [
  { value: 'daily',   label: 'Kunlik',   icon: '📅' },
  { value: 'weekly',  label: 'Haftalik', icon: '📆' },
  { value: 'monthly', label: 'Oylik',    icon: '🗓️' },
] as const

function StatCard({ label, value, sub, color = '#fff' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function exportCSV(report: ReportData) {
  const rows = [
    ['Hisobot turi', report.type],
    ['Davr', `${report.periodStart.slice(0, 10)} — ${report.periodEnd.slice(0, 10)}`],
    ['Yaratilgan', report.generatedAt.slice(0, 19)],
    [],
    ['Jami signallar', report.totalSignals],
    ['TP Hit', report.tpCount],
    ['SL Hit', report.slCount],
    ['Tugagan', report.expiredCount],
    ['Win Rate', `${report.winRate}%`],
    ['Profit Factor', report.profitFactor],
    ['Avg RR', report.avgRR],
    ['Avg Confidence', `${report.avgConfidence}%`],
    [],
    ['BUY soni', report.buyCount],
    ['SELL soni', report.sellCount],
    ['Forex', report.forexCount],
    ['Crypto', report.cryptoCount],
    [],
    ['Yangi foydalanuvchilar', report.newUsers],
    ['Yangi obunalar', report.newSubscriptions],
    ['Daromad ($)', report.revenue],
    [],
    ['Juftlik', 'Signallar', 'Win Rate'],
    ...report.topPairs.map(p => [p.pair, p.signals, `${p.winRate}%`]),
    [],
    ['Timeframe', 'Soni', 'Win Rate'],
    ...report.tfBreakdown.map(t => [t.tf, t.count, `${t.winRate}%`]),
  ]

  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${report.type}-${report.periodStart.slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState('')

  const loadReport = useCallback(async () => {
    setLoading(true); setMsg('')
    try {
      const res = await fetch(`/api/admin/reports?type=${reportType}&date=${date}`)
      const data = await res.json() as { report?: ReportData; error?: string; cached?: boolean }
      if (data.error) throw new Error(data.error)
      setReport(data.report ?? null)
      if (data.cached) setMsg('Keshdan yuklandi')
    } catch (e) {
      setMsg(`Xato: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [reportType, date])

  useEffect(() => { loadReport() }, [loadReport])

  const regenerate = async () => {
    setGenerating(true); setMsg('')
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: reportType, date }),
      })
      const data = await res.json() as { report?: ReportData; error?: string }
      if (data.error) throw new Error(data.error)
      setReport(data.report ?? null)
      setMsg('✓ Hisobot qayta yaratildi')
    } catch (e) {
      setMsg(`Xato: ${e instanceof Error ? e.message : e}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ padding: '24px 28px', background: '#0a0e1a', minHeight: '100vh', color: '#f9fafb' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText style={{ width: 20, height: 20, color: '#5B8BFF' }} />
            Signal Hisobotlari
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
            Kunlik / Haftalik / Oylik signal natijalari va statistika
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {report && (
            <button onClick={() => exportCSV(report)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: '#00D4AA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Download style={{ width: 13, height: 13 }} /> CSV Export
            </button>
          )}
          <button onClick={regenerate} disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: 'rgba(245,183,49,0.1)', border: '1px solid rgba(245,183,49,0.3)', color: '#F5B731', fontSize: 13, fontWeight: 600, cursor: generating ? 'wait' : 'pointer' }}>
            <RefreshCw style={{ width: 13, height: 13 }} /> {generating ? '...' : 'Qayta hisoblash'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Type pills */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, gap: 2 }}>
          {REPORT_TYPES.map(t => (
            <button key={t.value}
              onClick={() => setReportType(t.value)}
              style={{
                padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: reportType === t.value ? '#5B8BFF' : 'transparent',
                color: reportType === t.value ? '#fff' : '#6b7280',
              }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* Date picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '6px 12px' }}>
          <Calendar style={{ width: 13, height: 13, color: '#6b7280' }} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }} />
        </div>

        {msg && <span style={{ fontSize: 12, color: msg.startsWith('✓') ? '#00D4AA' : msg.startsWith('Kesh') ? '#9ca3af' : '#FF4D6A' }}>{msg}</span>}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: 40, fontSize: 14 }}>Yuklanmoqda...</div>
      )}

      {!loading && report && (
        <>
          {/* Period info */}
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20, background: 'rgba(91,139,255,0.06)', border: '1px solid rgba(91,139,255,0.15)', borderRadius: 8, padding: '8px 14px', display: 'inline-block' }}>
            📊 {report.periodStart.slice(0, 10)} — {report.periodEnd.slice(0, 10)} | Yaratilgan: {report.generatedAt.slice(0, 19).replace('T', ' ')}
          </div>

          {/* Main stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard label="Jami signallar" value={report.totalSignals} color="#fff" />
            <StatCard label="Win Rate" value={`${report.winRate}%`} sub={`${report.tpCount} TP / ${report.slCount} SL`} color={report.winRate >= 60 ? '#00D4AA' : report.winRate >= 50 ? '#F5B731' : '#FF4D6A'} />
            <StatCard label="Profit Factor" value={report.profitFactor} color="#5B8BFF" />
            <StatCard label="Avg RR" value={`1:${report.avgRR}`} color="#9D6FFF" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <StatCard label="Avg Confidence" value={`${report.avgConfidence}%`} color="#F5B731" />
            <StatCard label="BUY / SELL" value={`${report.buyCount} / ${report.sellCount}`} color="#00D4AA" />
            <StatCard label="Yangi foydalanuvchilar" value={report.newUsers} color="#06b6d4" />
            <StatCard label="Daromad" value={`$${report.revenue.toLocaleString()}`} sub={`${report.newSubscriptions} yangi obuna`} color="#00D4AA" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top pairs */}
            <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 style={{ width: 14, height: 14 }} /> Top Juftliklar
              </div>
              {report.topPairs.length === 0 ? (
                <div style={{ color: '#4b5563', fontSize: 13 }}>Ma'lumot yo'q</div>
              ) : report.topPairs.map(p => (
                <div key={p.pair} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{p.pair}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280' }}>{p.signals} signal</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                      <div style={{ width: `${p.winRate}%`, height: '100%', background: p.winRate >= 60 ? '#00D4AA' : p.winRate >= 50 ? '#F5B731' : '#FF4D6A', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.winRate >= 60 ? '#00D4AA' : p.winRate >= 50 ? '#F5B731' : '#FF4D6A', minWidth: 36, textAlign: 'right' }}>{p.winRate}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeframe breakdown */}
            <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp style={{ width: 14, height: 14 }} /> Timeframe Natijalari
              </div>
              {report.tfBreakdown.length === 0 ? (
                <div style={{ color: '#4b5563', fontSize: 13 }}>Ma'lumot yo'q</div>
              ) : report.tfBreakdown.map(t => (
                <div key={t.tf} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5B8BFF' }}>{t.tf}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280' }}>{t.count} ta</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.winRate >= 60 ? '#00D4AA' : t.winRate >= 50 ? '#F5B731' : '#FF4D6A' }}>{t.winRate}%</span>
                </div>
              ))}

              {/* Market split */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>Bozor taqsimoti</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#5B8BFF' }}>{report.forexCount}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Forex</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#F5B731' }}>{report.cryptoCount}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Crypto</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <TrendingUp style={{ width: 18, height: 18, color: '#00D4AA' }} />
                    <div style={{ fontSize: 10, color: '#6b7280' }}>{report.buyCount} BUY</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <TrendingDown style={{ width: 18, height: 18, color: '#FF4D6A' }} />
                    <div style={{ fontSize: 10, color: '#6b7280' }}>{report.sellCount} SELL</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !report && (
        <div style={{ textAlign: 'center', color: '#4b5563', padding: 60, fontSize: 14 }}>
          <FileText style={{ width: 40, height: 40, color: '#1f2937', margin: '0 auto 12px' }} />
          <div>Hisobot topilmadi.</div>
          <button onClick={regenerate} disabled={generating}
            style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, background: 'rgba(91,139,255,0.1)', border: '1px solid rgba(91,139,255,0.3)', color: '#5B8BFF', cursor: 'pointer', fontSize: 13 }}>
            Yaratish
          </button>
        </div>
      )}
    </div>
  )
}
