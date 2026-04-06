'use client'

import Link from 'next/link'
import { useLivePrices } from '@/hooks/useMarketData'
import { Brain, Send, Target, Activity, CheckCircle2, XCircle, Clock, Zap, Flame, RefreshCw, AlertTriangle } from 'lucide-react'
import { useEffect, useState, useCallback, useRef } from 'react'

//  Types 
interface AiSignal {
  id: string
  symbol: string
  timeframe: string
  direction: 'BUY' | 'SELL'
  entry: number
  sl: number
  tp1: number
  tp2: number
  tp3: number
  rr: number
  /** Natija: open | tp1 | tp2 | tp3 | sl | cancelled */
  status: 'open' | 'tp1' | 'tp2' | 'tp3' | 'sl' | 'cancelled'
  /** Signal turi: ACTIVE (darhol) | PENDING (trigger kutiladi) */
  signalStatus: 'ACTIVE' | 'PENDING'
  triggerZone: { from: number; to: number } | null
  triggerCondition: string | null
  validUntil: string | null
  triggeredAt: string | null
  closedAt: string | null
  closedPrice: number | null
  pips: number | null
  createdAt: string
  chartUrl: string | null
  aiReply: string | null
}
interface SignalStats {
  total: number; open: number; active: number; pending: number
  wins: number; losses: number; cancelled: number; winRate: number; streak: number
}

//  Helpers 
function fmt(price: number) {
  if (price > 999) return price.toLocaleString('en', { maximumFractionDigits: 2 })
  if (price < 10)  return price.toFixed(5)
  return price.toFixed(3)
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'hozirgina'
  if (m < 60)  return `${m} daq avval`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h} soat avval`
  return `${Math.floor(h / 24)} kun avval`
}
function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Muddati tugagan'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}s ${m}d qoldi` : `${m} daqiqa qoldi`
}

function statusInfo(sig: AiSignal) {
  if (sig.status === 'open') {
    if (sig.signalStatus === 'PENDING')
      return { label: 'KUTILMOQDA', color: '#F5B731', bg: 'rgba(245,183,49,0.13)',   icon: Clock }
    return   { label: 'AKTIV',      color: '#00D4AA', bg: 'rgba(0,212,170,0.13)',     icon: Zap }
  }
  if (sig.status === 'sl')        return { label: 'SL ✗',      color: '#FF4D6A', bg: 'rgba(255,77,106,0.13)',  icon: XCircle }
  if (sig.status === 'cancelled') return { label: 'BEKOR',      color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: AlertTriangle }
  const tpLabel = sig.status.toUpperCase()
  return { label: tpLabel + ' ✓', color: '#00D4AA', bg: 'rgba(0,212,170,0.13)', icon: CheckCircle2 }
}

//  Stat Card 
function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType
}) {
  return (
    <div style={{
      background: '#0D0F18', border: `1px solid ${color}22`,
      borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: `${color}14`, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}15`, border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <p style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

//  Win Rate Circle 
function WinRateCircle({ winRate, wins, losses }: { winRate: number; wins: number; losses: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const progress = (winRate / 100) * circ
  const color = winRate >= 70 ? '#00D4AA' : winRate >= 50 ? '#F5B731' : '#FF4D6A'
  return (
    <div style={{ background: '#0D0F18', border: `1px solid ${color}22`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', alignSelf: 'flex-start' }}>AI Aniqlik</span>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={`${progress} ${circ}`}
          transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="55" y="51" textAnchor="middle" fill={color} fontSize="20" fontWeight="900">{winRate}%</text>
        <text x="55" y="66" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">Win Rate</text>
      </svg>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#00D4AA' }}>{wins}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>TP Hit</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#FF4D6A' }}>{losses}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>SL Hit</div>
        </div>
      </div>
    </div>
  )
}

//  Bar Chart: So'nggi 14 kun signals 
function SignalBarChart({ signals }: { signals: AiSignal[] }) {
  const days: { date: string; wins: number; losses: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const daySignals = signals.filter(s => s.createdAt?.slice(0, 10) === key && s.status !== 'open')
    days.push({ date: key.slice(5), wins: daySignals.filter(s => s.status.startsWith('tp')).length, losses: daySignals.filter(s => s.status === 'sl').length })
  }
  const maxVal = Math.max(...days.map(d => d.wins + d.losses), 1)
  const H = 80

  return (
    <div style={{ background: '#0D0F18', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18 }}>So'nggi 14 kun signallari</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: H + 24 }}>
        {days.map((d, i) => {
          const total = d.wins + d.losses
          const winH  = total > 0 ? Math.round((d.wins / maxVal) * H) : 0
          const lossH = total > 0 ? Math.round((d.losses / maxVal) * H) : 0
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: H, width: '100%', gap: 1 }}>
                {winH > 0  && <div style={{ borderRadius: '3px 3px 0 0', background: '#00D4AA', height: winH,  width: '100%', minHeight: 3 }} />}
                {lossH > 0 && <div style={{ borderRadius: '3px 3px 0 0', background: '#FF4D6A', height: lossH, width: '100%', minHeight: 3 }} />}
                {total === 0 && <div style={{ borderRadius: 3, background: 'rgba(255,255,255,0.05)', height: 4, width: '100%' }} />}
              </div>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', transform: 'rotate(-45deg)', transformOrigin: 'center', display: 'block', marginTop: 4 }}>{d.date}</span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#00D4AA' }} /><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>TP Hit</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#FF4D6A' }} /><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>SL Hit</span></div>
      </div>
    </div>
  )
}

//  Pips Chart 
function PipsChart({ signals }: { signals: AiSignal[] }) {
  const closed = signals.filter(s => s.status !== 'open' && s.pips !== null).slice(0, 20).reverse()
  if (closed.length < 2) return null
  const pips = closed.map(s => s.pips ?? 0)
  const max = Math.max(...pips.map(Math.abs), 1)
  let cumulative = 0
  const points = closed.map((s, i) => {
    cumulative += s.pips ?? 0
    const x = (i / (closed.length - 1)) * 280
    const y = 60 - (cumulative / (max * closed.length)) * 55
    return { x: Math.max(0, Math.min(280, x)), y: Math.max(5, Math.min(115, y)), pips: s.pips }
  })
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const lastY = points[points.length - 1]?.y ?? 60
  const fillPath = `${pathD} L 280 120 L 0 120 Z`
  const totalPips = pips.reduce((a, b) => a + b, 0)

  return (
    <div style={{ background: '#0D0F18', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Kumulativ Pips (so'nggi {closed.length})</h3>
        <span style={{ fontSize: 14, fontWeight: 800, color: totalPips >= 0 ? '#00D4AA' : '#FF4D6A', fontFamily: 'monospace' }}>{totalPips >= 0 ? '+' : ''}{totalPips.toFixed(1)}</span>
      </div>
      <svg width="100%" viewBox="0 0 280 120" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="cumGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={totalPips >= 0 ? '#00D4AA' : '#FF4D6A'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={totalPips >= 0 ? '#00D4AA' : '#FF4D6A'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="60" x2="280" y2="60" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
        <path d={fillPath} fill="url(#cumGrad)" />
        <path d={pathD} fill="none" stroke={totalPips >= 0 ? '#00D4AA' : '#FF4D6A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1]?.x ?? 0} cy={lastY} r="4" fill={totalPips >= 0 ? '#00D4AA' : '#FF4D6A'} />
      </svg>
    </div>
  )
}

//  Signal Modal 
function SignalModal({ sig, onClose }: { sig: AiSignal; onClose: () => void }) {
  const si = statusInfo(sig)
  const StatusIcon = si.icon
  const overlayRef = useRef<HTMLDivElement>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError,  setImgError]  = useState(false)

  const chartUrl = sig.chartUrl
    ?? `/api/chart?symbol=${sig.symbol}&tf=${sig.timeframe}&entry=${sig.entry}&sl=${sig.sl}&tp1=${sig.tp1}&tp2=${sig.tp2}&tp3=${sig.tp3}`

  // ESC tugmasi bilan yopish
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: '#0D0F18',
        border: `1px solid ${si.color}30`,
        borderRadius: 20,
        width: '100%',
        maxWidth: 820,
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px ${si.color}20`,
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
              background: sig.direction === 'BUY' ? 'rgba(0,212,170,0.18)' : 'rgba(255,77,106,0.18)',
              color: sig.direction === 'BUY' ? '#00D4AA' : '#FF4D6A',
            }}>{sig.direction}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{sig.symbol}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{sig.timeframe.toUpperCase()} · {timeAgo(sig.createdAt)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: si.bg, color: si.color, border: `1px solid ${si.color}30`,
            }}>
              <StatusIcon size={11} /> {si.label}
            </span>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        </div>

        {/* Modal body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Chart — /api/chart dan on-demand yuklanadi */}
          <div style={{ padding: '16px 22px 0' }}>
            {!imgLoaded && !imgError && (
              <div style={{
                height: 200, borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '3px solid rgba(91,139,255,0.25)',
                  borderTopColor: '#5B8BFF',
                  animation: 'spin 0.9s linear infinite',
                }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Grafik yuklanmoqda...</span>
              </div>
            )}
            {imgError && (
              <div style={{
                height: 80, borderRadius: 12,
                background: 'rgba(255,77,106,0.04)',
                border: '1px solid rgba(255,77,106,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'rgba(255,77,106,0.6)' }}>⚠ Grafik yuklanmadi (bozor yopiq yoki ma&#39;lumot yo&#39;q)</span>
              </div>
            )}
            <img
              src={chartUrl}
              alt={`${sig.symbol} chart`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              style={{
                width: '100%', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.07)',
                display: imgLoaded ? 'block' : 'none',
              }}
            />
          </div>

          {/* Signal levels grid */}
          <div className="sig-modal-levels">
            {[
              { label: 'ENTRY', value: fmt(sig.entry), color: '#fff' },
              { label: 'SL',    value: fmt(sig.sl),    color: '#FF4D6A' },
              { label: 'TP1',   value: fmt(sig.tp1),   color: '#00D4AA' },
              { label: 'TP2',   value: fmt(sig.tp2),   color: '#00D4AA' },
              { label: 'TP3',   value: fmt(sig.tp3),   color: '#00D4AA' },
              { label: 'R:R',   value: sig.rr.toFixed(1), color: '#F5B731' },
            ].map(item => (
              <div key={item.label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '10px 12px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* AI matni */}
          {sig.aiReply && (
            <div style={{ padding: '0 22px 22px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>AI Tahlili</p>
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '14px 16px',
                fontSize: 12, color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                maxHeight: 300, overflowY: 'auto',
              }}>
                {sig.aiReply}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

//  Live Prices mini 
const DISPLAY_PAIRS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'BTCUSDT', 'ETHUSDT', 'USDJPY']
function fmtPrice(price: number, sym: string) {
  if (sym.endsWith('USDT') || price > 999) return price.toLocaleString('en', { maximumFractionDigits: 2 })
  if (price < 10) return price.toFixed(5)
  return price.toFixed(3)
}

export default function DashboardPage() {
  const { data: liveData } = useLivePrices()
  const [signals,  setSignals]  = useState<AiSignal[]>([])
  const [stats,    setStats]    = useState<SignalStats>({ total: 0, open: 0, active: 0, pending: 0, wins: 0, losses: 0, cancelled: 0, winRate: 0, streak: 0 })
  const [loading,  setLoading]  = useState(true)
  const [modalSig, setModalSig] = useState<AiSignal | null>(null)

  const fetchSignals = useCallback(async () => {
    try {
      const r = await fetch('/api/signals/ai?limit=100')
      const d = await r.json() as { signals?: AiSignal[]; stats?: SignalStats }
      setSignals(d.signals ?? [])
      setStats(d.stats ?? { total: 0, open: 0, active: 0, pending: 0, wins: 0, losses: 0, cancelled: 0, winRate: 0, streak: 0 })
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  // Avtomatik natija tekshirish (background, UI ni bloklamaydi)
  const autoCheck = useCallback(async (hasOpen: boolean) => {
    if (!hasOpen) return
    try {
      await fetch('/api/signals/check-results')
      await fetch('/api/signals/ai?limit=100')
        .then(r => r.json())
        .then((d: { signals?: AiSignal[]; stats?: SignalStats }) => {
          if (d.signals) setSignals(d.signals)
          if (d.stats)   setStats(d.stats)
        })
    } catch { /* background xato — logga tushadi */ }
  }, [])

  // Sahifa yuklanganda signallarni olish + avtomatik tekshirish
  useEffect(() => {
    fetchSignals().then(() => {
      // Yuklangandan keyin bir marta tekshiramiz
      setTimeout(() => {
        fetch('/api/signals/ai?limit=100')
          .then(r => r.json())
          .then((d: { signals?: AiSignal[] }) => {
            const hasOpen = (d.signals ?? []).some(s => s.status === 'open')
            autoCheck(hasOpen)
          })
          .catch(() => {})
      }, 2000)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Har 5 daqiqada avtomatik tekshirish (ochiq signal bo'lsa)
  useEffect(() => {
    const hasOpen = signals.some(s => s.status === 'open')
    if (!hasOpen) return
    const id = setInterval(() => autoCheck(true), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [signals, autoCheck])

  const openSignals    = signals.filter(s => s.status === 'open')
  const activeSignals  = openSignals.filter(s => s.signalStatus === 'ACTIVE')
  const pendingSignals = openSignals.filter(s => s.signalStatus === 'PENDING')
  const closedSignals  = signals.filter(s => s.status !== 'open')
  const hasPips        = signals.some(s => s.pips !== null)

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Signal modal */}
      {modalSig && <SignalModal sig={modalSig} onClose={() => setModalSig(null)} />}

      {/*  Header  */}
      <div className="dash-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 2 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 3 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>FATH AI  signal natijalari va statistika</p>
        </div>
        <div className="dash-header-btns" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setLoading(true); fetchSignals() }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 10, background: 'rgba(91,139,255,0.1)', border: '1px solid rgba(91,139,255,0.25)', color: '#5B8BFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Yangilash
          </button>
          <Link href="/chat" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#5B8BFF,#9D6FFF)', textDecoration: 'none', color: '#fff', fontSize: 12, fontWeight: 700 }}>
            <Brain size={13} /> AI Chat
          </Link>
          <a href="https://t.me/trader_ai_bot" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 10, background: 'rgba(29,161,242,0.1)', border: '1px solid rgba(29,161,242,0.2)', textDecoration: 'none', color: '#1DA1F2', fontSize: 12, fontWeight: 700 }}>
            <Send size={13} /> Telegram
          </a>
        </div>
      </div>

      {/*  Live Prices Ticker  */}
      <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', background: '#0D0F18', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', minWidth: 480 }}>
        {DISPLAY_PAIRS.map((sym, i) => {
          const p = liveData?.prices.find(pr => pr.symbol === sym)
          const isUp = (p?.change ?? 0) >= 0
          return (
            <div key={sym} style={{ padding: '13px 16px', borderRight: i < DISPLAY_PAIRS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                {sym.replace('USDT', '').replace('=X', '')}
              </p>
              {p ? (
                <>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'monospace', marginBottom: 2 }}>{fmtPrice(p.price, sym)}</p>
                  <p style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: isUp ? '#00D4AA' : '#FF4D6A' }}>
                    {isUp ? '' : ''} {Math.abs(p.changePercent).toFixed(2)}%
                  </p>
                </>
              ) : (
                <>
                  <div className="skeleton" style={{ height: 17, width: 68, borderRadius: 4, marginBottom: 5 }} />
                  <div className="skeleton" style={{ height: 12, width: 44, borderRadius: 4 }} />
                </>
              )}
            </div>
          )
        })}
      </div>
      </div>

      {/*  Stat Cards (5 ta: Active + Pending alohida ko'rsatiladi)  */}
      <div className="dash-stats-grid">
        <StatCard label="Jami Signallar" value={String(stats.total)} sub={`${stats.open} ta ochiq`}                                        color="#5B8BFF" icon={Activity} />
        <StatCard label="Aktiv Signallar" value={String(stats.active ?? 0)} sub="darhol kuzatilmoqda"                                        color="#00D4AA" icon={Zap} />
        <StatCard label="Kutilayotgan"   value={String(stats.pending ?? 0)} sub="trigger kutilmoqda"                                         color="#F5B731" icon={Clock} />
        <StatCard label="Win Rate"        value={(stats.wins + stats.losses) > 0 ? `${stats.winRate}%` : '—'} sub={`${stats.wins} TP ✓  ${stats.losses} SL ✗  ${stats.cancelled ?? 0} bekor`} color={stats.winRate >= 60 ? '#00D4AA' : stats.winRate >= 45 ? '#F5B731' : '#FF4D6A'} icon={Target} />
        <StatCard label="TP Seriya"       value={String(stats.streak)} sub="ketma-ket g'alaba"                                              color="#F5B731" icon={Flame} />
      </div>

      {/*  Charts Row  */}
      <div className="dash-charts-row">
        <WinRateCircle winRate={stats.winRate} wins={stats.wins} losses={stats.losses} />
        <SignalBarChart signals={signals} />
        {hasPips && <PipsChart signals={signals} />}
      </div>

      {/*  AKTIV Signallar (darhol kuzatilmoqda)  */}
      {activeSignals.length > 0 && (
        <div style={{ background: 'rgba(0,212,170,0.04)', border: '1px solid rgba(0,212,170,0.20)', borderRadius: 18, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D4AA', display: 'inline-block', boxShadow: '0 0 10px #00D4AA', animation: 'pulse 2s ease-in-out infinite' }} />
            Aktiv Signallar <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(0,212,170,0.6)' }}>({activeSignals.length}) — OHLCV bilan kuzatilmoqda</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
            {activeSignals.map(sig => {
              const livePrice = liveData?.prices.find(p => p.symbol === sig.symbol)?.price
              const isBuy = sig.direction === 'BUY'
              const livePnl = livePrice != null ? (livePrice - sig.entry) * (isBuy ? 1 : -1) : null
              const isProfit = (livePnl ?? 0) >= 0
              return (
                <div key={sig.id} onClick={() => setModalSig(sig)}
                  style={{ background: '#0D0F18', borderRadius: 14, padding: 16, border: `1px solid ${isProfit ? 'rgba(0,212,170,0.25)' : 'rgba(255,77,106,0.18)'}`, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                  {/* Direction strip */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: '14px 0 0 14px', background: isBuy ? '#00D4AA' : '#FF4D6A' }} />
                  <div style={{ paddingLeft: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{sig.symbol}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, fontWeight: 700, background: isBuy ? 'rgba(0,212,170,0.15)' : 'rgba(255,77,106,0.15)', color: isBuy ? '#00D4AA' : '#FF4D6A' }}>{sig.direction}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{sig.timeframe}</span>
                      </div>
                      {livePnl !== null && (
                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: livePnl >= 0 ? '#00D4AA' : '#FF4D6A' }}>
                          {livePnl >= 0 ? '+' : ''}{livePnl.toFixed(livePnl > 10 ? 1 : 4)}
                        </span>
                      )}
                    </div>
                    {/* Progress bar: SL ← current price → TP1 */}
                    {livePrice != null && (() => {
                      const lo = Math.min(sig.sl, sig.tp1), hi = Math.max(sig.sl, sig.tp1)
                      const pct = Math.max(0, Math.min(100, ((livePrice - lo) / (hi - lo || 1)) * 100))
                      return (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', marginBottom: 5 }}>
                            <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: '100%', borderRadius: 3, background: isProfit ? '#00D4AA' : '#FF4D6A', transition: 'width 0.5s' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                            <span>SL {fmt(sig.sl)}</span>
                            <span style={{ color: '#fff', fontWeight: 700 }}>● {fmt(livePrice)}</span>
                            <span>TP1 {fmt(sig.tp1)}</span>
                          </div>
                        </div>
                      )
                    })()}
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                      <span>Entry: <b style={{ color: '#fff', fontFamily: 'monospace' }}>{fmt(sig.entry)}</b></span>
                      <span>R:R <b style={{ color: '#F5B731' }}>{sig.rr.toFixed(1)}</b></span>
                      <span>{timeAgo(sig.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/*  PENDING Signallar (trigger kutilmoqda)  */}
      {pendingSignals.length > 0 && (
        <div style={{ background: 'rgba(245,183,49,0.03)', border: '1px solid rgba(245,183,49,0.18)', borderRadius: 18, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={14} color="#F5B731" />
            Kutilayotgan Signallar <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(245,183,49,0.6)' }}>({pendingSignals.length}) — trigger zonasi kutilmoqda</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
            {pendingSignals.map(sig => {
              const livePrice = liveData?.prices.find(p => p.symbol === sig.symbol)?.price
              const isBuy = sig.direction === 'BUY'
              const tz = sig.triggerZone
              // Trigger zonasiga yaqinlashish foizi
              let triggerPct = 0
              if (livePrice != null && tz) {
                const zoneCenter = (tz.from + tz.to) / 2
                const distFromEntry = Math.abs(sig.entry - zoneCenter) || 1
                const distNow = Math.abs(livePrice - zoneCenter)
                triggerPct = Math.max(0, Math.min(100, (1 - distNow / distFromEntry) * 100))
              }
              return (
                <div key={sig.id} onClick={() => setModalSig(sig)}
                  style={{ background: '#0D0F18', borderRadius: 14, padding: 16, border: '1px solid rgba(245,183,49,0.20)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: '14px 0 0 14px', background: '#F5B731' }} />
                  <div style={{ paddingLeft: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{sig.symbol}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, fontWeight: 700, background: isBuy ? 'rgba(0,212,170,0.15)' : 'rgba(255,77,106,0.15)', color: isBuy ? '#00D4AA' : '#FF4D6A' }}>{sig.direction}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{sig.timeframe}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#F5B731', fontWeight: 600 }}>⏳ KUTILMOQDA</span>
                    </div>
                    {/* Trigger zone progress */}
                    {tz && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
                          Trigger zona: {fmt(tz.from)} — {fmt(tz.to)}
                        </div>
                        <div style={{ position: 'relative', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', marginBottom: 3 }}>
                          <div style={{ position: 'absolute', left: 0, width: `${triggerPct}%`, height: '100%', borderRadius: 3, background: '#F5B731', transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                          Yaqinlashish: {triggerPct.toFixed(0)}%
                        </div>
                      </div>
                    )}
                    {sig.validUntil && (
                      <div style={{ fontSize: 10, color: 'rgba(245,183,49,0.75)', marginBottom: 6 }}>
                        ⏰ {timeLeft(sig.validUntil)}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', wordBreak: 'break-word' }}>
                      {sig.triggerCondition ?? `Kirish darajasi: ${fmt(sig.entry)}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/*  Signals Table  */}
      <div style={{ background: '#0D0F18', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>AI Signallari</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/market" style={{ fontSize: 12, color: '#5B8BFF', textDecoration: 'none', fontWeight: 600 }}>Bozor </Link>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 8 }}>{signals.length} ta</span>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 58, borderRadius: 12 }} />)}
          </div>
        ) : signals.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 0' }}>
            <Brain size={44} color="rgba(255,255,255,0.08)" />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.7 }}>
              Hali signal yo&#39;q.<br />AI Chat da juftlik bo&#39;yicha signal so&#39;rang.
            </p>
            <Link href="/chat" style={{ padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#5B8BFF,#9D6FFF)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              Signal olish 
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {/* Table column headers */}
            <div className="sig-table-grid" style={{ padding: '0 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 6 }}>
              {["YO'NAL", 'JUFTLIK', 'KIRISH', 'SL', 'TP1', 'R:R', 'HOLAT'].map(h => (
                <span key={h} className={['SL','TP1','R:R'].includes(h) ? 'sig-col-hide-sm' : ''} style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {signals.slice(0, 25).map(sig => {
                const si = statusInfo(sig)
                const StatusIcon = si.icon
                return (
                  <div
                    key={sig.id}
                    onClick={() => setModalSig(sig)}
                    className="sig-table-grid"
                    style={{ padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${si.color}28` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.04)' }}
                  >
                    <div>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 800, background: sig.direction === 'BUY' ? 'rgba(0,212,170,0.18)' : 'rgba(255,77,106,0.18)', color: sig.direction === 'BUY' ? '#00D4AA' : '#FF4D6A' }}>
                        {sig.direction}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sig.symbol} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{sig.timeframe}</span>
                      </p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{timeAgo(sig.createdAt)}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{fmt(sig.entry)}</span>
                    <span className="sig-col-hide-sm" style={{ fontSize: 12, fontWeight: 700, color: '#FF4D6A', fontFamily: 'monospace' }}>{fmt(sig.sl)}</span>
                    <span className="sig-col-hide-sm" style={{ fontSize: 12, fontWeight: 700, color: '#00D4AA', fontFamily: 'monospace' }}>{fmt(sig.tp1)}</span>
                    <span className="sig-col-hide-sm" style={{ fontSize: 12, fontWeight: 700, color: '#F5B731', fontFamily: 'monospace' }}>{sig.rr.toFixed(1)}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: si.bg, color: si.color, border: `1px solid ${si.color}25`, width: 'fit-content' }}>
                        <StatusIcon size={10} /> {si.label}
                      </span>
                      {sig.pips !== null && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: sig.pips >= 0 ? '#00D4AA' : '#FF4D6A', fontFamily: 'monospace', paddingLeft: 2 }}>
                          {sig.pips >= 0 ? '+' : ''}{sig.pips.toFixed(1)}p
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
