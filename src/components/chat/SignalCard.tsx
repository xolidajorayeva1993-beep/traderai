'use client'
// ============================================================
// SignalCard.tsx — FATH AI Signal Karta | Yangi dizayn
// ============================================================
import { useState } from 'react'
import type { ChatSignalData } from '@/lib/ai/types'

interface Props {
  signal: ChatSignalData
  chartBase64?: string
  onChartZoom?: (src: string) => void
}

function fmtP(n: number): string {
  if (!isFinite(n) || n === 0) return '–'
  if (n >= 10000) return n.toFixed(1)
  if (n >= 100)   return n.toFixed(2)
  if (n >= 10)    return n.toFixed(3)
  return n.toFixed(5)
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: '100%', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: '100%', borderRadius: 4,
        background: color, transition: 'width 0.7s ease',
      }} />
    </div>
  )
}

function StatusBadge({ status }: { status: 'ACTIVE' | 'PENDING' | 'NO_TRADE' }) {
  const cfg = {
    ACTIVE:   { label: '🟢  FAOL SIGNAL',  bg: '#003D2E', border: '#00D4AA', color: '#00F5C4' },
    PENDING:  { label: '🕐  KUTILMOQDA',   bg: '#3D2E00', border: '#F5B731', color: '#FFD060' },
    NO_TRADE: { label: '🚫  SAVDO YO\'Q',  bg: '#3D0010', border: '#FF4D6A', color: '#FF7090' },
  }[status]
  return (
    <span style={{
      padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 800,
      letterSpacing: '0.05em', background: cfg.bg,
      border: `1.5px solid ${cfg.border}`, color: cfg.color,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {cfg.label}
    </span>
  )
}

function DirectionBadge({ direction }: { direction: 'BUY' | 'SELL' | 'NEUTRAL' }) {
  const cfg = {
    BUY:     { label: '▲ SOTIB OLISH', color: '#00F5C4', bg: '#003D2E', border: '#00D4AA' },
    SELL:    { label: '▼ SOTISH',      color: '#FF7090', bg: '#3D0010', border: '#FF4D6A' },
    NEUTRAL: { label: '◆ KUTING',      color: '#FFD060', bg: '#3D2E00', border: '#F5B731' },
  }[direction]
  return (
    <span style={{
      padding: '7px 20px', borderRadius: 10, fontSize: 16, fontWeight: 900,
      color: cfg.color, background: cfg.bg,
      border: `1.5px solid ${cfg.border}`,
      letterSpacing: '0.03em',
    }}>
      {cfg.label}
    </span>
  )
}

export default function SignalCard({ signal, chartBase64, onChartZoom }: Props) {
  const [showDetails, setShowDetails] = useState(false)
  const FM = { fontFamily: 'monospace' } as const

  const isActive  = signal.status === 'ACTIVE'
  const isPending = signal.status === 'PENDING'
  const isNoTrade = signal.status === 'NO_TRADE'

  const accentColor =
    signal.direction === 'BUY'  ? '#00D4AA' :
    signal.direction === 'SELL' ? '#FF4D6A' : '#F5B731'

  const borderLeft =
    isActive  ? '4px solid #00D4AA' :
    isPending ? '4px solid #F5B731' :
                '4px solid #555577'

  const validUntil = signal.validHours > 0
    ? `${signal.validHours} soat amal qiladi`
    : null

  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.10)',
      borderLeft,
      background: '#10111C',
      overflow: 'hidden',
      fontSize: 13,
      color: '#E8EAF6',
      width: '100%',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>

      {/* ═══ SARLAVHA ═══════════════════════════════════════ */}
      <div style={{
        padding: '14px 18px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 900, ...FM, color: '#FFFFFF' }}>
              📊 {signal.symbol}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', ...FM }}>
              {signal.timeframe.toUpperCase()}
            </span>
            <StatusBadge status={signal.status} />
          </div>
          {!isNoTrade && <DirectionBadge direction={signal.direction} />}
        </div>

        {/* Ishonch darajasi */}
        {!isNoTrade && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                📡 FATH AI ishonch darajasi
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: accentColor, ...FM }}>
                {signal.confidence}%
              </span>
            </div>
            <Bar value={signal.confidence} color={accentColor} />
          </div>
        )}
      </div>

      {/* ═══ FAOL SIGNAL: Narx darajalari ════════════════════ */}
      {isActive && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: '#00D4AA', fontWeight: 800, marginBottom: 12, letterSpacing: '0.08em' }}>
            ✅  HOZIR KIRISH MUMKIN
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            <LevelBox label="📍 Kirish narxi" value={fmtP(signal.entry)} color="#5B8BFF" bold />
            <LevelBox label="🛑 To'xtash (SL)" value={fmtP(signal.sl)} color="#FF6080" bold />
            <LevelBox
              label="🎯 Maqsad 1 (TP1)"
              value={fmtP(signal.tp1)} color="#00D4AA"
              sub={`Nisbat: 1:${Math.abs((signal.tp1 - signal.entry) / Math.max(0.001, Math.abs(signal.entry - signal.sl))).toFixed(1)}`}
            />
            <LevelBox
              label="🎯 Maqsad 2 (TP2)"
              value={fmtP(signal.tp2)} color="#00D4AA"
              sub={`Nisbat: 1:${Math.abs((signal.tp2 - signal.entry) / Math.max(0.001, Math.abs(signal.entry - signal.sl))).toFixed(1)}`}
            />
            <LevelBox
              label="🎯 Maqsad 3 (TP3)"
              value={fmtP(signal.tp3)} color="#00D4AA"
              sub={`Nisbat: 1:${Math.abs((signal.tp3 - signal.entry) / Math.max(0.001, Math.abs(signal.entry - signal.sl))).toFixed(1)}`}
            />
            <LevelBox label="⚖️ Xavf/Foyda" value={`1 : ${signal.rr.toFixed(1)}`} color="#C8D0FF" />
          </div>
        </div>
      )}

      {/* ═══ KUTILAYOTGAN SIGNAL: Trigger zona ═══════════════ */}
      {isPending && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 12, color: '#FFD060', fontWeight: 800, marginBottom: 10, letterSpacing: '0.06em' }}>
            🕐  LIMIT BUYURTMA — KIRISH SHARTI
          </div>

          {signal.triggerZone && (
            <div style={{
              padding: '12px 16px', borderRadius: 10, marginBottom: 14,
              background: 'rgba(245,183,49,0.08)',
              border: '1.5px solid rgba(245,183,49,0.30)',
            }}>
              <div style={{ fontSize: 13, color: '#FFD060', fontWeight: 800, marginBottom: 6, ...FM }}>
                📍 Trigger zona: {fmtP(signal.triggerZone.from)} – {fmtP(signal.triggerZone.to)}
              </div>
              {signal.triggerCondition && (
                <div style={{ fontSize: 13, color: '#FFFFFF', lineHeight: 1.6 }}>
                  {signal.triggerCondition}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            <LevelBox label="📍 Kirish narxi" value={fmtP(signal.entry)} color="#5B8BFF" bold />
            <LevelBox label="🛑 To'xtash (SL)" value={fmtP(signal.sl)} color="#FF6080" bold />
            <LevelBox label="🎯 Maqsad 1 (TP1)" value={fmtP(signal.tp1)} color="#00D4AA" />
            <LevelBox label="🎯 Maqsad 2 (TP2)" value={fmtP(signal.tp2)} color="#00D4AA" />
            <LevelBox label="🎯 Maqsad 3 (TP3)" value={fmtP(signal.tp3)} color="#00D4AA" />
            <LevelBox label="⚖️ Xavf/Foyda" value={`1 : ${signal.rr.toFixed(1)}`} color="#C8D0FF" />
          </div>

          {signal.invalidateAbove && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#FF7090' }}>
              ⚠️ Bekor bo'ladi: narx {fmtP(signal.invalidateAbove)} dan{' '}
              {signal.direction === 'SELL' ? 'yuqoriga chiqsa' : 'pastga tushsa'}
            </div>
          )}
          {signal.invalidateBelow && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#FF7090' }}>
              ⚠️ Bekor bo'ladi: narx {fmtP(signal.invalidateBelow)} dan pastga tushsa
            </div>
          )}
          {validUntil && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)', ...FM }}>
              ⏳ {validUntil}
            </div>
          )}
        </div>
      )}

      {/* ═══ FATH AI KONSENSUS ballari ═══════════════════════ */}
      {!isNoTrade && (
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 10, letterSpacing: '0.08em' }}>
            🤖  FATH AI TAHLIL BALLARI
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <EngineRow label="👁  Ko'rish tahlili"    value={signal.engineScores.visionEngine}  color="#9D6FFF" />
            <EngineRow label="📊  Bozor tahlili"      value={signal.engineScores.marketEngine}  color="#5B8BFF" />
            <EngineRow label="🧮  Matematik tahlil"   value={signal.engineScores.mathEngine}    color="#00D4AA" />
          </div>
        </div>
      )}

      {/* ═══ CHART ═══════════════════════════════════════════ */}
      {chartBase64 && (
        <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
            📈  Texnik grafik
          </div>
          <div
            onClick={() => onChartZoom?.(`data:image/svg+xml;base64,${chartBase64}`)}
            style={{ cursor: 'zoom-in', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <img
              src={`data:image/svg+xml;base64,${chartBase64}`}
              alt="FATH AI Grafik"
              style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'contain', background: '#07080C' }}
            />
          </div>
        </div>
      )}

      {/* ═══ BATAFSIL TAHLIL (accordion) ═════════════════════ */}
      <div>
        <button
          onClick={() => setShowDetails(v => !v)}
          style={{
            width: '100%', padding: '12px 18px',
            background: 'rgba(255,255,255,0.025)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600,
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <span>📋  Batafsil bozor tahlili</span>
          <span style={{ fontSize: 15 }}>{showDetails ? '▲' : '▼'}</span>
        </button>

        {showDetails && (
          <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Bozor holati */}
            <Section title="🌐  Bozor holati">
              <InfoRow label="Trend yo\u2019nalishi" value={
                signal.deepAnalysis.trend === 'bullish' ? '\uD83D\uDCC8  Ko\u02BCtarilish (Bullish)' :
                signal.deepAnalysis.trend === 'bearish' ? '\uD83D\uDCC9  Tushish (Bearish)' : '\u27A1\uFE0F  Yon (Sideways)'
              } />
              <InfoRow label="Narx joylashuvi" value={signal.deepAnalysis.pricePosition} />
              <InfoRow label="Momentum" value={
                signal.deepAnalysis.momentum === 'strengthening' ? '💪  Kuchayib bormoqda' :
                signal.deepAnalysis.momentum === 'weakening'     ? '🔻  Susayib bormoqda'  :
                signal.deepAnalysis.momentum === 'reversing'     ? '🔄  Burilish belgilari' :
                                                                   '➡️  Neytral'
              } />
              <InfoRow label="Umumiy ball" value={`${signal.deepAnalysis.confluenceScore}/100`} highlight />
            </Section>

            {/* Texnik indikatorlar */}
            <Section title="📊  Texnik indikatorlar">
              <InfoRow label="RSI ko'rsatkichi" value={`${signal.deepAnalysis.rsi.value} — ${
                signal.deepAnalysis.rsi.state === 'overbought' ? '🔴  Yuqori zona (sotish bosimi)' :
                signal.deepAnalysis.rsi.state === 'oversold'   ? '🟢  Past zona (sotib olish bosimi)' :
                                                                 '🟡  Neytral zona'
              }`} />
              <InfoRow label="MACD" value={signal.deepAnalysis.macd.state} />
              <InfoRow label="EMA tartibi" value={
                signal.deepAnalysis.emaOrder === 'bullish' ? '\uD83D\uDCC8  Ko\u02BCtarilish (20>50>200)' :
                signal.deepAnalysis.emaOrder === 'bearish' ? '\uD83D\uDCC9  Tushish (20<50<200)' :
                                                             '\u2194\uFE0F  Aralash holat'
              } />
              <InfoRow label="ATR o'zgaruvchanlik" value={
                signal.deepAnalysis.atr.level === 'low'    ? '🟢  Past — tinch bozor' :
                signal.deepAnalysis.atr.level === 'medium' ? '🟡  O\'rta — oddiy holat' :
                                                             '🔴  Yuqori — ehtiyot bo\'ling'
              } />
              <InfoRow label={`ADX trend kuchi (${signal.deepAnalysis.adx.value})`} value={
                signal.deepAnalysis.adx.strength === 'weak'   ? '⚪  Trend yo\'q (20 dan past)' :
                signal.deepAnalysis.adx.strength === 'trend'  ? '🟡  Trend bor (20–40)' :
                                                                '🟢  Kuchli trend (40 dan yuqori)'
              } />
            </Section>

            {/* SMC */}
            <Section title="💰  Smart Money tahlili">
              <InfoRow label="Oxirgi BOS (tuzilma)" value={
                signal.deepAnalysis.lastBOSDirection === 'bullish' ? '\u2B06\uFE0F  Ko\u02BCtarilish tomonga' :
                signal.deepAnalysis.lastBOSDirection === 'bearish' ? '\u2B07\uFE0F  Tushish tomonga' :
                                                                     '\u2753  Aniqlanmadi'
              } />
              <InfoRow label="FVG (to\u02BCldirilmagan bo\u02BCshliq)" value={
                signal.deepAnalysis.activeFVG ? '✅  Faol FVG mavjud' : '❌  FVG yo\'q'
              } />
            </Section>

            {/* Ssenariylar */}
            <Section title="🎬  Narx ssenariylari">
              <div style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 8,
                background: 'rgba(0,212,170,0.07)', border: '1px solid rgba(0,212,170,0.25)',
              }}>
                <div style={{ fontSize: 12, color: '#00D4AA', fontWeight: 800, marginBottom: 5 }}>
                  📈  KO'TARILISH SSENARIY
                </div>
                <div style={{ fontSize: 13, color: '#DDEEFF', lineHeight: 1.65 }}>
                  {signal.deepAnalysis.scenarios.bull}
                </div>
              </div>
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(255,77,106,0.07)', border: '1px solid rgba(255,77,106,0.25)',
              }}>
                <div style={{ fontSize: 12, color: '#FF7090', fontWeight: 800, marginBottom: 5 }}>
                  📉  TUSHISH SSENARIY
                </div>
                <div style={{ fontSize: 13, color: '#DDEEFF', lineHeight: 1.65 }}>
                  {signal.deepAnalysis.scenarios.bear}
                </div>
              </div>
            </Section>
          </div>
        )}
      </div>

      {/* ═══ FOOTER ══════════════════════════════════════════ */}
      <div style={{
        padding: '8px 18px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', ...FM }}>
          FATH AI • {new Date().toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {validUntil && !isNoTrade && (
          <span style={{ fontSize: 11, color: accentColor, ...FM, opacity: 0.7 }}>
            ⏳ {validUntil}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Yordamchi komponentlar ───────────────────────────────────

function LevelBox({ label, value, color, sub, bold }: {
  label: string; value: string; color: string; sub?: string; bold?: boolean
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 8,
      padding: '10px 12px',
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: bold ? 17 : 15, fontWeight: bold ? 900 : 700, color, fontFamily: 'monospace' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontFamily: 'monospace' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function EngineRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}%</span>
      </div>
      <Bar value={value} color={color} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 10,
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '12px 14px',
      marginTop: 4,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.60)',
        letterSpacing: '0.05em', marginBottom: 10,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', flexShrink: 0, minWidth: 120 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, color: highlight ? '#00F5C4' : '#DDEEFF',
        fontWeight: highlight ? 800 : 500,
        textAlign: 'right', lineHeight: 1.4,
      }}>
        {value}
      </span>
    </div>
  )
}
