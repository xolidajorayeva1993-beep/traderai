// ============================================================
// chartRenderer.ts   Professional SVG chart — FATH AI
// S/R Zones | Trendlines | OB | FVG | BOS | Legend
// ============================================================
import type { OHLCVCandle, FullAnalysisResult, SNRZone, Trendline, FairValueGap, SMCResult } from './types'

export interface Levels {
  entry: number
  tp1: number
  tp2: number
  tp3: number
  sl: number
  rr: number
}

// === Layout ===================================================
const SHOW = 75
const CW   = 36
const ML   = 12
const MT   = 72
const RAW  = 210
const MW   = SHOW * CW
const MH   = 820
const XAH  = 60
const TW   = ML + MW + RAW
const TH   = MT + MH + XAH
const RX   = ML + MW

// === Colors ===================================================
const BG    = '#070710'
const CHART = '#0b0b15'
const AXBG  = '#08080f'
const BULL  = '#26a69a'
const BEAR  = '#ef5350'
const ENTRY = '#5B8BFF'
const TP    = '#26a69a'
const TP1C  = '#00D4AA'
const TP2C  = '#26a69a'
const TP3C  = '#1a8a7a'
const SL    = '#ef5350'
const GRID  = 'rgba(255,255,255,0.055)'
const BORD  = 'rgba(255,255,255,0.20)'
const TXTD  = 'rgba(255,255,255,0.50)'
const EMA200 = '#FF8C42'
const EMA50  = '#C77DFF'
const EMA20  = '#4FC3F7'

// === Helpers ==================================================
function esc(s: string | number): string {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function fmtP(n: number): string {
  if (!isFinite(n) || n === 0) return '-'
  if (n >= 10000) return n.toFixed(1)
  if (n >= 100)   return n.toFixed(2)
  if (n >= 10)    return n.toFixed(3)
  return n.toFixed(5)
}

function sy(p: number, lo: number, hi: number, top: number, h: number): number {
  if (hi === lo) return top + h / 2
  return top + ((hi - p) / (hi - lo)) * h
}

function slotX(slot: number): number {
  return ML + (slot + 0.5) * CW
}

// === EMA ======================================================
function calcEMA(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  if (closes.length < period) return out
  const k = 2 / (period + 1)
  let v = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = v
  for (let i = period; i < closes.length; i++) {
    v = closes[i] * k + v * (1 - k)
    out[i] = v
  }
  return out
}

// === SVG primitives ===========================================
function R(x: number, y: number, w: number, h: number, fill: string, ex = ''): string {
  if (w <= 0 || h <= 0) return ''
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0.5,w).toFixed(1)}" height="${Math.max(0.5,h).toFixed(1)}" fill="${fill}" ${ex}/>`
}

function L(x1: number, y1: number, x2: number, y2: number, stroke: string, sw: number|string = 1, ex = ''): string {
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" ${ex}/>`
}

function Txt(x: number, y: number, v: string|number, fill: string, ex = ''): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${fill}" ${ex}>${esc(v)}</text>`
}

function mkPath(pts: [number, number][], stroke: string, sw: string): string {
  const valid = pts.filter(([, y]) => isFinite(y))
  if (valid.length < 2) return ''
  return `<path d="${valid.map(([x,y],i) => (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`
}

// === Sections =================================================
function drawBG(): string {
  return [
    R(0, 0, TW, TH, BG),
    R(ML, MT, MW, MH, CHART),
    R(RX, 0, RAW, TH, AXBG),
    L(RX, MT, RX, MT + MH, BORD, 2),
    `<rect x="${ML}" y="${MT}" width="${MW}" height="${MH}" fill="none" stroke="${BORD}" stroke-width="1.8"/>`,
  ].join('\n')
}

function drawHeader(symbol: string, tf: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const FM = 'font-family="monospace"'
  return [
    Txt(ML, 52, symbol, '#dfe6f5', `font-size="34" font-weight="800" ${FM}`),
    Txt(ML + 180, 52, '\u2022 ' + tf.toUpperCase(), 'rgba(255,255,255,0.75)', `font-size="26" ${FM}`),
    Txt(ML + 310, 52, '\u2022 ' + date, TXTD, `font-size="18" ${FM}`),
    `<circle cx="${ML+490}" cy="44" r="7" fill="${BULL}"><animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/></circle>`,
    Txt(ML + 504, 52, 'LIVE', BULL, `font-size="17" font-weight="800" ${FM} letter-spacing="0.12em"`),
  ].join('\n')
}

function drawGrid(gridPrices: number[], lo: number, hi: number): string {
  const parts: string[] = []
  for (const p of gridPrices) {
    const y = sy(p, lo, hi, MT, MH)
    if (y < MT || y > MT + MH) continue
    parts.push(L(ML, y, ML + MW, y, GRID, 1))
  }
  for (let slot = 0; slot <= SHOW; slot += 10) {
    const x = ML + slot * CW
    parts.push(L(x, MT, x, MT + MH, GRID, 0.8))
  }
  return parts.join('\n')
}

function drawYAxis(gridPrices: number[], lo: number, hi: number, cur: number): string {
  const parts: string[] = []
  const FM = 'font-family="monospace"'
  for (const p of gridPrices) {
    const y = sy(p, lo, hi, MT, MH)
    if (y < MT + 10 || y > MT + MH - 10) continue
    parts.push(L(RX, y, RX + 10, y, TXTD, 1.5))
    parts.push(Txt(RX + 16, y + 6, fmtP(p), TXTD, `font-size="18" ${FM}`))
  }
  const yc = sy(cur, lo, hi, MT, MH)
  if (yc >= MT && yc <= MT + MH) {
    // Current price dashed line across chart
    parts.push(L(ML, yc, ML + MW, yc, 'rgba(91,139,255,0.50)', 1.5, 'stroke-dasharray="6 8"'))
    // Arrow-badge (same style as signal badges but semi-transparent)
    const ph = 30, pw = RAW - 14, ax = RX + 2
    const arrowPts = [
      `${ax.toFixed(1)},${yc.toFixed(1)}`,
      `${(ax + 10).toFixed(1)},${(yc - ph / 2).toFixed(1)}`,
      `${(ax + pw).toFixed(1)},${(yc - ph / 2).toFixed(1)}`,
      `${(ax + pw).toFixed(1)},${(yc + ph / 2).toFixed(1)}`,
      `${(ax + 10).toFixed(1)},${(yc + ph / 2).toFixed(1)}`,
    ].join(' ')
    parts.push(`<polygon points="${arrowPts}" fill="${ENTRY}" opacity="0.88"/>`)
    parts.push(Txt(ax + 15, yc + 7, fmtP(cur), '#fff', `font-size="18" font-weight="900" ${FM}`))
  }
  return parts.join('\n')
}

function drawXAxis(visCan: OHLCVCandle[], offset: number): string {
  const parts: string[] = []
  const ay = MT + MH + 6
  const step = Math.ceil(SHOW / 8)
  const FM = 'font-family="monospace" font-size="17"'

  for (let j = 0; j < visCan.length; j++) {
    const slot = offset + j
    if (slot % step !== 0) continue
    const c = visCan[j]
    const x = slotX(slot)
    const d = new Date(c.timestamp)
    const lbl = (d.getMonth()+1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':00'
    parts.push(L(x, MT + MH, x, ay + 6, TXTD, 1))
    parts.push(Txt(x - 30, ay + 26, lbl, TXTD, FM))
  }
  return parts.join('\n')
}

function drawEMA(allCandles: OHLCVCandle[], start: number, visLen: number, offset: number, lo: number, hi: number): string {
  const closes = allCandles.map(c => c.close)
  const e20  = calcEMA(closes, 20)
  const e50  = calcEMA(closes, 50)
  const e200 = calcEMA(closes, 200)

  function buildPts(vals: (number|null)[]): [number,number][] {
    const pts: [number,number][] = []
    for (let j = 0; j < visLen; j++) {
      const v = vals[start + j]
      if (v == null) continue
      const y = sy(v, lo, hi, MT, MH)
      if (y >= MT - 4 && y <= MT + MH + 4) pts.push([slotX(offset + j), y])
    }
    return pts
  }

  return [
    mkPath(buildPts(e200), EMA200, '2.5'),
    mkPath(buildPts(e50),  EMA50,  '2.2'),
    mkPath(buildPts(e20),  EMA20,  '1.8'),
  ].join('\n')
}

function drawCandles(visCan: OHLCVCandle[], offset: number, lo: number, hi: number): string {
  const parts: string[] = []
  const bodyW = Math.max(2, CW * 0.72)
  const wickW = Math.max(1, CW * 0.15)

  for (let j = 0; j < visCan.length; j++) {
    const c    = visCan[j]
    const slot = offset + j
    const x    = slotX(slot)
    const isBull = c.close >= c.open
    const col    = isBull ? BULL : BEAR

    const yH = sy(c.high,  lo, hi, MT, MH)
    const yL = sy(c.low,   lo, hi, MT, MH)
    const yO = sy(c.open,  lo, hi, MT, MH)
    const yC = sy(c.close, lo, hi, MT, MH)

    parts.push(L(x, yH, x, yL, col, wickW))

    const bTop = Math.min(yO, yC)
    const bH   = Math.max(1, Math.abs(yO - yC))
    const bx   = x - bodyW / 2

    if (isBull) {
      parts.push(`<rect x="${bx.toFixed(1)}" y="${bTop.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${bH.toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.6"/>`)
    } else {
      parts.push(`<rect x="${bx.toFixed(1)}" y="${bTop.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${bH.toFixed(1)}" fill="${col}"/>`)
    }
  }
  return parts.join('\n')
}

function drawSignalLines(levels: Levels, lo: number, hi: number): string {
  const isNeutral = levels.sl === levels.entry && levels.tp1 === levels.entry
  if (isNeutral) return ''

  const FM   = 'font-family="monospace"'
  const parts: string[] = []

  // ── Zone shading: profit (green) and loss (red) areas ──────
  const yE  = sy(levels.entry, lo, hi, MT, MH)
  const yT3 = sy(levels.tp3,   lo, hi, MT, MH)
  const yS  = sy(levels.sl,    lo, hi, MT, MH)
  const tpT = Math.max(MT,      Math.min(yE, yT3))
  const tpB = Math.min(MT + MH, Math.max(yE, yT3))
  const slT = Math.max(MT,      Math.min(yE, yS))
  const slB = Math.min(MT + MH, Math.max(yE, yS))
  if (tpB - tpT > 2) parts.push(R(ML, tpT, MW, tpB - tpT, TP1C, 'opacity="0.07"'))
  if (slB - slT > 2) parts.push(R(ML, slT, MW, slB - slT, SL,   'opacity="0.09"'))

  // ── Lines + badges: TP3→TP2→TP1→SL→ENTRY (ENTRY drawn last = on top) ──
  const specs = [
    { p: levels.tp3,   col: TP3C,  lbl: 'TP3',   sw: '1.6', dsh: '5 9'  },
    { p: levels.tp2,   col: TP2C,  lbl: 'TP2',   sw: '2.0', dsh: '8 7'  },
    { p: levels.tp1,   col: TP1C,  lbl: 'TP1',   sw: '2.4', dsh: '10 6' },
    { p: levels.sl,    col: SL,    lbl: 'SL',    sw: '2.8', dsh: '12 6' },
    { p: levels.entry, col: ENTRY, lbl: 'ENTRY', sw: '3.4', dsh: ''     },
  ]

  for (const s of specs) {
    if (!isFinite(s.p) || s.p <= 0) continue
    const y = sy(s.p, lo, hi, MT, MH)
    if (y < MT - 5 || y > MT + MH + 5) continue
    const isEntry = s.lbl === 'ENTRY'

    // Horizontal line across chart
    const dash = s.dsh ? `stroke-dasharray="${s.dsh}"` : ''
    parts.push(L(ML, y, ML + MW, y, s.col, s.sw, `${dash} opacity="0.95"`))

    // LEFT pill badge: dark bg + colored border + label
    const lblW = isEntry ? 84 : 56
    const lblH = 30
    parts.push(`<rect x="${(ML + 3).toFixed(1)}" y="${(y - lblH / 2).toFixed(1)}" width="${lblW}" height="${lblH}" rx="6" fill="#07080f" stroke="${s.col}" stroke-width="1.8" opacity="0.97"/>`)
    parts.push(Txt(ML + 10, y + 7, s.lbl, s.col, `font-size="16" font-weight="900" ${FM}`))

    // RIGHT arrow-badge: left-pointing chevron ◄[ PRICE ]
    const ph = 32, pw = RAW - 14, ax = RX + 2
    const arrowPts = [
      `${ax.toFixed(1)},${y.toFixed(1)}`,
      `${(ax + 11).toFixed(1)},${(y - ph / 2).toFixed(1)}`,
      `${(ax + pw).toFixed(1)},${(y - ph / 2).toFixed(1)}`,
      `${(ax + pw).toFixed(1)},${(y + ph / 2).toFixed(1)}`,
      `${(ax + 11).toFixed(1)},${(y + ph / 2).toFixed(1)}`,
    ].join(' ')
    parts.push(`<polygon points="${arrowPts}" fill="${s.col}" opacity="0.93"/>`)
    // Price text inside badge (white, bold)
    parts.push(Txt(ax + 17, y + 8, fmtP(s.p), '#fff', `font-size="18" font-weight="900" ${FM}`))
  }

  // ── R:R badge (just above ENTRY arrow badge on right panel) ─
  if (levels.rr > 0 && isFinite(levels.rr)) {
    const yE2  = sy(levels.entry, lo, hi, MT, MH)
    const rrY  = yE2 - 22
    if (rrY > MT + 14 && rrY < MT + MH - 4) {
      const good   = levels.rr >= 2
      const rrBg   = good ? 'rgba(0,212,170,0.16)'  : 'rgba(255,179,71,0.10)'
      const rrBord = good ? 'rgba(0,212,170,0.50)'  : 'rgba(255,179,71,0.40)'
      const rrCol  = good ? '#00D4AA'                : '#FFB347'
      parts.push(`<rect x="${(RX + 2).toFixed(1)}" y="${(rrY - 13).toFixed(1)}" width="${RAW - 16}" height="24" rx="5" fill="${rrBg}" stroke="${rrBord}" stroke-width="1"/>`)
      parts.push(Txt(RX + 10, rrY + 6, `R:R  ${levels.rr.toFixed(2)}`, rrCol, `font-size="14" font-weight="800" ${FM}`))
    }
  }

  return parts.join('\n')
}

// === S/R Zona Boxes ==========================================
function drawSNRZones(zones: SNRZone[], lo: number, hi: number): string {
  const parts: string[] = []
  const FM = 'font-family="monospace"'
  const supports    = zones.filter(z => z.type === 'support').slice(0, 4)
  const resistances = zones.filter(z => z.type === 'resistance').slice(0, 4)

  for (const zone of supports) {
    const yT = sy(zone.priceTop,    lo, hi, MT, MH)
    const yB = sy(zone.priceBottom, lo, hi, MT, MH)
    const h  = Math.max(2, yB - yT)
    if (yT > MT + MH || yB < MT) continue
    const strong = zone.strength >= 60
    parts.push(`<rect x="${ML}" y="${yT.toFixed(1)}" width="${MW}" height="${h.toFixed(1)}" fill="rgba(255,77,106,0.09)" stroke="rgba(255,77,106,${strong ? '0.55' : '0.28'})" stroke-width="${strong ? 1.5 : 1}"/>`)
    const ly = Math.max(MT + 14, Math.min(MT + MH - 6, yT + h / 2 + 5))
    parts.push(Txt(RX - 88, ly, 'Support', '#FF4D6A', `font-size="13" ${FM} opacity="0.75"`))
    if (strong) parts.push(Txt(ML + 10, ly, '⬛', '#FF4D6A', `font-size="11" ${FM} opacity="0.5"`))
  }

  for (const zone of resistances) {
    const yT = sy(zone.priceTop,    lo, hi, MT, MH)
    const yB = sy(zone.priceBottom, lo, hi, MT, MH)
    const h  = Math.max(2, yB - yT)
    if (yT > MT + MH || yB < MT) continue
    const strong = zone.strength >= 60
    parts.push(`<rect x="${ML}" y="${yT.toFixed(1)}" width="${MW}" height="${h.toFixed(1)}" fill="rgba(157,111,255,0.09)" stroke="rgba(157,111,255,${strong ? '0.55' : '0.28'})" stroke-width="${strong ? 1.5 : 1}"/>`)
    const ly = Math.max(MT + 14, Math.min(MT + MH - 6, yT + h / 2 + 5))
    parts.push(Txt(RX - 104, ly, 'Resistance', '#9D6FFF', `font-size="13" ${FM} opacity="0.75"`))
  }

  return parts.join('\n')
}

// === Trend Chiziqlar =========================================
function drawTrendlines(
  trendlines: Trendline[],
  candleCount: number,
  start: number,
  visLen: number,
  offset: number,
  lo: number, hi: number,
): string {
  const parts: string[] = []
  const FM = 'font-family="monospace"'

  for (const tl of trendlines.slice(0, 3)) {
    if (tl.endIndex < start) continue

    const iStart = Math.max(tl.startIndex, start)
    const iEnd   = Math.min(tl.endIndex,   candleCount - 1)
    const totalSpan = tl.endIndex - tl.startIndex
    if (totalSpan === 0) continue

    const priceAtIStart = tl.startPrice + (tl.endPrice - tl.startPrice) * ((iStart - tl.startIndex) / totalSpan)
    const priceAtIEnd   = tl.endPrice

    const x1 = slotX(offset + (iStart - start))
    const y1 = sy(priceAtIStart, lo, hi, MT, MH)
    const x2 = slotX(offset + (iEnd - start))
    const y2 = sy(priceAtIEnd,   lo, hi, MT, MH)

    const col   = tl.direction === 'up' ? BULL : BEAR
    const alpha = tl.broken ? '0.30' : '0.65'
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="2" stroke-dasharray="14 5" opacity="${alpha}"/>`)

    // Trend label
    const labelY = Math.max(MT + 16, Math.min(MT + MH - 16, y2 - 14))
    const label  = tl.direction === 'up' ? '↗ Trend' : '↘ Trend'
    parts.push(Txt(x2 - 48, labelY, label, col, `font-size="13" font-weight="700" ${FM} opacity="${alpha}"`))
  }
  return parts.join('\n')
}

// === Fair Value Gap (FVG) Zonalari ==========================
function drawFVGZones(
  fvgs: FairValueGap[],
  start: number,
  lo: number, hi: number,
): string {
  const parts: string[] = []
  const FM = 'font-family="monospace"'

  const visible = fvgs.filter(f => !f.filled && f.startIndex >= start - 20).slice(-5)
  for (const fvg of visible) {
    const yT = sy(fvg.top,    lo, hi, MT, MH)
    const yB = sy(fvg.bottom, lo, hi, MT, MH)
    const h  = Math.max(2, yB - yT)
    if (yT > MT + MH || yB < MT) continue
    const fill   = fvg.direction === 'bullish' ? 'rgba(91,139,255,0.09)'   : 'rgba(239,83,80,0.09)'
    const stroke = fvg.direction === 'bullish' ? 'rgba(91,139,255,0.38)'   : 'rgba(239,83,80,0.38)'
    const col    = fvg.direction === 'bullish' ? '#5B8BFF' : '#ef5350'
    parts.push(`<rect x="${ML}" y="${yT.toFixed(1)}" width="${MW}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-dasharray="5 4"/>`)
    const ly = Math.max(MT + 12, Math.min(MT + MH - 6, yT + h / 2 + 4))
    parts.push(Txt(RX - 32, ly, 'FVG', col, `font-size="12" ${FM} opacity="0.65"`))
  }
  return parts.join('\n')
}

// === Order Block Zonalari ====================================
function drawOrderBlocks(
  candles: OHLCVCandle[],
  start: number,
  offset: number,
  lo: number, hi: number,
): string {
  const parts: string[] = []
  const FM = 'font-family="monospace"'

  type OB = { direction: 'bullish' | 'bearish'; high: number; low: number; index: number }
  const obs: OB[] = []

  for (let i = 3; i < candles.length - 3; i++) {
    const c = candles[i]
    const bearish = c.close < c.open
    const bullish = c.close >= c.open
    const next3   = [candles[i+1], candles[i+2], candles[i+3]]

    if (bearish && next3.every(x => x.close > x.open)) {
      // Bullish OB: so'ngi bearish sham kuchli bullish impuls oldidan
      const mitigated = candles.slice(i + 4).some(x => x.low <= c.high && x.high >= c.low)
      if (!mitigated) obs.push({ direction: 'bullish', high: c.high, low: c.low, index: i })
    }
    if (bullish && next3.every(x => x.close < x.open)) {
      // Bearish OB: so'ngi bullish sham kuchli bearish impuls oldidan
      const mitigated = candles.slice(i + 4).some(x => x.high >= c.low && x.low <= c.high)
      if (!mitigated) obs.push({ direction: 'bearish', high: c.high, low: c.low, index: i })
    }
  }

  const visibleOBs = obs.filter(ob => ob.index >= start).slice(-3)
  for (const ob of visibleOBs) {
    const yH  = sy(ob.high, lo, hi, MT, MH)
    const yL  = sy(ob.low,  lo, hi, MT, MH)
    const boxH = Math.max(3, yL - yH)
    const x1   = slotX(offset + (ob.index - start))
    const boxW = ML + MW - x1
    if (boxW <= 0 || yH > MT + MH || yL < MT) continue

    const fill   = ob.direction === 'bullish' ? 'rgba(38,166,154,0.14)'  : 'rgba(239,83,80,0.14)'
    const stroke = ob.direction === 'bullish' ? 'rgba(38,166,154,0.60)'  : 'rgba(239,83,80,0.60)'
    const col    = ob.direction === 'bullish' ? '#26a69a' : '#ef5350'
    parts.push(`<rect x="${x1.toFixed(1)}" y="${yH.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`)
    const ly = Math.max(MT + 12, Math.min(MT + MH - 6, yH + boxH / 2 + 4))
    parts.push(Txt(x1 + 5, ly, 'OB', col, `font-size="12" font-weight="700" ${FM} opacity="0.75"`))
  }
  return parts.join('\n')
}

// === BOS / CHoCH Belgilari ==================================
function drawBOSLabels(
  smc: SMCResult,
  start: number,
  offset: number,
  visLen: number,
  lo: number, hi: number,
): string {
  const parts: string[] = []
  const FM = 'font-family="monospace"'

  // Market structure HH/LL nuqtalarida BOS label
  const recentPts = smc.marketStructure
    .filter(p => p.index >= start && (p.type === 'HH' || p.type === 'LL'))
    .slice(-4)

  for (const pt of recentPts) {
    const visIdx = Math.min(pt.index - start, visLen - 1)
    const x = slotX(offset + visIdx)
    const y = sy(pt.price, lo, hi, MT, MH)
    if (y < MT + 10 || y > MT + MH - 10) continue
    const bull  = pt.type === 'HH'
    const col   = bull ? BULL : BEAR
    const lbl   = bull ? 'BOS↑' : 'BOS↓'
    const ly    = bull ? y - 22 : y + 28
    parts.push(`<rect x="${(x-18).toFixed(1)}" y="${(ly-14).toFixed(1)}" width="38" height="17" rx="3" fill="${col}" opacity="0.15"/>`)
    parts.push(Txt(x - 14, ly - 1, lbl, col, `font-size="11" font-weight="800" ${FM}`))
  }

  // CHoCH
  if (smc.lastCHoCH) {
    const x  = slotX(offset + Math.max(0, visLen - 4))
    const y  = sy(smc.lastCHoCH.price, lo, hi, MT, MH)
    const col = smc.lastCHoCH.direction === 'bullish' ? BULL : BEAR
    if (y > MT + 16 && y < MT + MH - 16) {
      parts.push(`<rect x="${(x-28).toFixed(1)}" y="${(y-24).toFixed(1)}" width="58" height="17" rx="3" fill="${col}" opacity="0.14"/>`)
      parts.push(Txt(x - 24, y - 11, 'CHoCH', col, `font-size="11" font-weight="800" ${FM}`))
    }
  }
  return parts.join('\n')
}

// === Legend Panel ============================================
function drawLegend(): string {
  const FM = 'font-family="monospace"'
  const items = [
    { col: EMA20,                       label: 'EMA 20'  },
    { col: EMA50,                       label: 'EMA 50'  },
    { col: EMA200,                      label: 'EMA 200' },
    { col: 'rgba(255,77,106,0.85)',      label: 'Support' },
    { col: 'rgba(157,111,255,0.85)',     label: 'Resist.' },
    { col: 'rgba(38,166,154,0.85)',      label: 'OB Bull' },
    { col: 'rgba(239,83,80,0.85)',       label: 'OB Bear' },
    { col: 'rgba(91,139,255,0.85)',      label: 'FVG'     },
  ]
  const cols = 4
  const IW = 88, IH = 20
  const LX = ML + 10, LY = MT + 8
  const totalW = IW * cols + 14
  const totalH = Math.ceil(items.length / cols) * IH + 10
  const parts: string[] = [
    `<rect x="${LX}" y="${LY}" width="${totalW}" height="${totalH}" rx="5" fill="rgba(7,7,16,0.78)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>`,
  ]
  items.forEach((item, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = LX + 8 + col * IW
    const y = LY + 8 + row * IH
    parts.push(`<circle cx="${x + 5}" cy="${y + 5}" r="5" fill="${item.col}"/>`)
    parts.push(Txt(x + 15, y + 10, item.label, 'rgba(255,255,255,0.52)', `font-size="12" ${FM}`))
  })
  return parts.join('\n')
}

// === MAIN EXPORT =============================================
export function generateChartSVG(
  symbol: string,
  timeframe: string,
  candles: OHLCVCandle[],
  analysis: FullAnalysisResult,
  levels: Levels
): string {
  if (!candles || candles.length === 0) {
    return `<svg width="${TW}" height="${TH}" xmlns="http://www.w3.org/2000/svg"><rect width="${TW}" height="${TH}" fill="${BG}"/><text x="${TW/2}" y="${TH/2}" fill="${TXTD}" font-size="24" text-anchor="middle" font-family="monospace">Ma'lumot yo'q</text></svg>`
  }

  const start  = Math.max(0, candles.length - SHOW)
  const visCan = candles.slice(start)
  const visLen = visCan.length
  const offset = SHOW - visLen

  const hiRaw = Math.max(...visCan.map(c => c.high))
  const loRaw = Math.min(...visCan.map(c => c.low))

  const hasLevels = levels.sl !== levels.entry && levels.tp1 !== levels.entry
  const hiAll = hasLevels ? Math.max(hiRaw, levels.entry, levels.tp1, levels.tp2, levels.tp3, levels.sl) : hiRaw
  const loAll = hasLevels ? Math.min(loRaw, levels.entry, levels.tp1, levels.tp2, levels.tp3, levels.sl) : loRaw

  const pad = (hiAll - loAll) * 0.08
  const hi  = hiAll + pad
  const lo  = loAll - pad

  const gridPx: number[] = []
  const gs = (hi - lo) / 7
  for (let i = 0; i <= 7; i++) gridPx.push(lo + i * gs)

  const cur        = candles[candles.length - 1].close
  const clipMain   = `<clipPath id="cm"><rect x="${ML}" y="${MT}" width="${MW}" height="${MH}"/></clipPath>`
  // Signal chiziqlari uchun keng clip (o'ng panel ham kiradi — price label uchun)
  const clipSignal = `<clipPath id="cs"><rect x="0" y="${MT - 20}" width="${TW}" height="${MH + 40}"/></clipPath>`
  const snrZones   = analysis?.snr?.zones             ?? []
  const trendlines = analysis?.trendline?.trendlines   ?? []
  const fvgZones   = analysis?.smc?.fvgZones           ?? []
  const smcResult  = analysis?.smc                     ?? null

  return `<svg width="${TW}" height="${TH}" viewBox="0 0 ${TW} ${TH}" xmlns="http://www.w3.org/2000/svg">
<defs>${clipMain}${clipSignal}</defs>
${drawBG()}
${drawHeader(symbol, timeframe)}
${drawGrid(gridPx, lo, hi)}
<g clip-path="url(#cm)">
${snrZones.length   ? drawSNRZones(snrZones, lo, hi) : ''}
${fvgZones.length   ? drawFVGZones(fvgZones, start, lo, hi) : ''}
${drawOrderBlocks(candles, start, offset, lo, hi)}
${drawCandles(visCan, offset, lo, hi)}
${drawEMA(candles, start, visLen, offset, lo, hi)}
${trendlines.length ? drawTrendlines(trendlines, candles.length, start, visLen, offset, lo, hi) : ''}
${smcResult         ? drawBOSLabels(smcResult, start, offset, visLen, lo, hi) : ''}
</g>
${drawLegend()}
${drawYAxis(gridPx, lo, hi, cur)}
${drawXAxis(visCan, offset)}
<g clip-path="url(#cs)">
${drawSignalLines(levels, lo, hi)}
</g>
<text x="${(TW/2).toFixed(0)}" y="${TH-10}" fill="rgba(255,255,255,0.07)" font-size="13" font-family="monospace" text-anchor="middle" letter-spacing="0.12em">FATH AI</text>
</svg>`
}
