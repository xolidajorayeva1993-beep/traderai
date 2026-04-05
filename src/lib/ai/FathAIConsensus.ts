// ============================================================
// FATH AI Consensus Engine
// 3 manbani birlashtiradi:
//   Vision Engine  (35%) — Chart va Pattern tahlili
//   Market Engine  (35%) — SNR + SMC tahlili
//   Math Engine    (30%) — Matematik confluence tahlili
// ============================================================

import type { GPTVerdict, GeminiVerdict, MathAnalysis, FathAISignal, SignalStatus, ChatSignalData } from './types'
import type { SNRZone, SMCResult, IndicatorResult } from '../analysis/types'

type Direction = 'BUY' | 'SELL' | 'NEUTRAL'

const WEIGHTS = { gpt: 0.35, gemini: 0.35, math: 0.30 } as const

function dirScore(dir: Direction): 1 | 0 | -1 {
  return dir === 'BUY' ? 1 : dir === 'SELL' ? -1 : 0
}

function pickNum(
  gpt: GPTVerdict | null,
  gemini: GeminiVerdict | null,
  key: 'entry' | 'stopLoss' | 'takeProfit1' | 'takeProfit2' | 'takeProfit3',
  fallback: number,
): number {
  const vals: number[] = []
  if (gpt && gpt[key]) vals.push(gpt[key])
  if (gemini && gemini[key]) vals.push(gemini[key])
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : fallback
}

export function buildFathAIConsensus(
  gpt: GPTVerdict | null,
  gemini: GeminiVerdict | null,
  math: MathAnalysis,
  currentPrice: number,
): FathAISignal {
  // ─── Yo'nalish bo'yicha og'irlikli ovoz ─────────────────────
  const gptDir    = gpt?.direction    ?? 'NEUTRAL'
  const geminiDir = gemini?.direction ?? 'NEUTRAL'
  const mathDir   = math.direction

  const gptConf   = gpt?.confidence    ?? 0
  const geminiConf = gemini?.confidence ?? 0
  const mathConf   = math.score

  // Har bir manbaning og'irlikli balini hisoblash
  const totalBias =
    WEIGHTS.gpt    * dirScore(gptDir)    * (gptConf    / 100) +
    WEIGHTS.gemini * dirScore(geminiDir) * (geminiConf / 100) +
    WEIGHTS.math   * dirScore(mathDir)   * (mathConf   / 100)

  // Yakuniy yo'nalish
  let direction: Direction
  if (totalBias > 0.12) direction = 'BUY'
  else if (totalBias < -0.12) direction = 'SELL'
  else direction = 'NEUTRAL'

  // Ishonch darajasi (barcha manbalar agregatidan)
  const weightedConf =
    WEIGHTS.gpt    * gptConf +
    WEIGHTS.gemini * geminiConf +
    WEIGHTS.math   * mathConf

  // Kelishuv bonusi: agar barcha 3 ta bir yo'nalishda bo'lsa +8
  const allAgree = gptDir === direction && geminiDir === direction && mathDir === direction
  const twoAgree = [gptDir, geminiDir, mathDir].filter(d => d === direction).length >= 2
  const bonus = allAgree ? 8 : twoAgree ? 3 : 0

  const rawConf = Math.round(Math.min(99, weightedConf + bonus))
  const confidence = direction === 'NEUTRAL' ? Math.max(0, rawConf - 10) : rawConf

  // Ziddiyat bormi?
  const hasConflict =
    (gptDir !== 'NEUTRAL' && geminiDir !== 'NEUTRAL' && gptDir !== geminiDir) ||
    (gptDir !== 'NEUTRAL' && mathDir !== 'NEUTRAL' && gptDir !== mathDir)

  // Umumiy signal nomi
  let consensus: string
  if (direction === 'NEUTRAL') consensus = 'NEUTRAL'
  else if (hasConflict) consensus = direction === 'BUY' ? 'WEAK_BUY' : 'WEAK_SELL'
  else if (confidence >= 72 && allAgree) consensus = direction === 'BUY' ? 'STRONG_BUY' : 'STRONG_SELL'
  else if (twoAgree) consensus = direction === 'BUY' ? 'MODERATE_BUY' : 'MODERATE_SELL'
  else consensus = direction === 'BUY' ? 'WEAK_BUY' : 'WEAK_SELL'

  // ─── Narx darajalari (AI lardан o'rtacha, yo'q bo'lsa matematik) ─
  const entry       = pickNum(gpt, gemini, 'entry',       currentPrice)
  const stopLoss    = pickNum(gpt, gemini, 'stopLoss',    currentPrice)
  const takeProfit1 = pickNum(gpt, gemini, 'takeProfit1', currentPrice)
  const takeProfit2 = pickNum(gpt, gemini, 'takeProfit2', currentPrice)
  const takeProfit3 = pickNum(gpt, gemini, 'takeProfit3', currentPrice)

  let riskReward = '1:1'
  const risk   = Math.abs(entry - stopLoss)
  const reward = Math.abs(takeProfit2 - entry)
  if (risk > 0 && reward > 0) riskReward = `1:${(reward / risk).toFixed(1)}`

  // ─── Birlashgan reasoning ─────────────────────────────────────
  const mathReasoning = buildMathReasoning(math, direction)
  const gptReasoning    = gpt?.reasoning    ?? null
  const geminiReasoning = gemini?.reasoning ?? null

  // Qaysi manbalar ishtirok etdi
  const sources: string[] = []
  if (gpt)    sources.push(`GPT-4o (${gptDir}, ${gptConf}%)`)
  if (gemini) sources.push(`Gemini (${geminiDir}, ${geminiConf}%)`)
  sources.push(`Matematik (${mathDir}, ${mathConf}%)`)

  // Asosiy reasoning matni (Uzbek)
  const reasonParts: string[] = []
  if (direction !== 'NEUTRAL') {
    reasonParts.push(`FATH AI: ${direction} signali (Ishonch: ${confidence}%).`)
    if (gpt?.reasoning)    reasonParts.push(`[Trendline/Pattern] ${gpt.reasoning}`)
    if (gemini?.reasoning) reasonParts.push(`[SNR/SMC] ${gemini.reasoning}`)
    reasonParts.push(`[Matematik] ${mathReasoning}`)
    if (hasConflict) reasonParts.push('⚠️ Manbalar orasida qisman ziddiyat bor — ehtiyot bo\'ling.')
  } else {
    reasonParts.push('FATH AI: Aniq signal aniqlanmadi. Bozor kutish holatida.')
    if (hasConflict) reasonParts.push('GPT va Gemini zid yo\'nalishda — NEUTRAL turing.')
  }
  const reasoning = reasonParts.join(' ')

  const watchout = gpt?.watchout || gemini?.watchout || (hasConflict ? 'Manbalar orasida ziddiyat bor' : 'Tavakkalchilikni boshqaring')

  return {
    direction,
    confidence,
    consensus,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskReward,
    reasoning,
    gptReasoning,
    geminiReasoning,
    mathReasoning,
    conflict: hasConflict,
    sources,
  }
}

function buildMathReasoning(math: MathAnalysis, direction: Direction): string {
  const parts = [`Matematik confluence: ${math.score}% → ${math.direction}.`]
  const top = Object.entries(math.components)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}%`)
  if (top.length > 0) parts.push(`Kuchli strategiyalar: ${top.join(', ')}.`)
  return parts.join(' ')
}

// ─── Signal Holati Aniqlash ──────────────────────────────────────
// ACTIVE: narx hoziroq kirish zonasida, darhol kirish mumkin
// PENDING: setup bor lekin narx hali optimal zonaga yetmagan
// NO_TRADE: bozor noaniq yoki signal sifatsiz

interface SignalStatusResult {
  status: SignalStatus
  triggerZone?: { from: number; to: number }
  triggerCondition?: string
  validHours: number
  invalidateAbove?: number
  invalidateBelow?: number
  noTradeReason?: string
  nextCheckTime?: string
  // PENDING holatida entry/sl ni trigger zona bilan moslashtiriladi
  adjustedEntry?: number
  adjustedSl?: number
}

export function determineSignalStatus(
  direction: Direction,
  confidence: number,
  conflict: boolean,
  currentPrice: number,
  entry: number,
  sl: number,
  tp1: number,
  snrZones: SNRZone[],
  confluenceScore: number,
): SignalStatusResult {
  // NEUTRAL yoki past confidence → PENDING (NO_TRADE qaytarilmaydi)
  if (direction === 'NEUTRAL') {
    const spread = currentPrice * 0.002
    return {
      status: 'PENDING',
      validHours: 4,
      triggerZone: { from: +(currentPrice - spread).toFixed(5), to: +(currentPrice + spread).toFixed(5) },
      triggerCondition: 'Bozor yo\'nalishi aniqlanishini kuting — signal kuchayganida kirish',
    }
  }

  if (confidence < 52) {
    const spread = Math.abs(entry > 0 ? entry : currentPrice) * 0.002
    const base = entry > 0 ? entry : currentPrice
    return {
      status: 'PENDING',
      validHours: 4,
      triggerZone: { from: +(base - spread).toFixed(5), to: +(base + spread).toFixed(5) },
      triggerCondition: `Confluence kuchayishini kuting (${confidence}%) — ${direction} signali hali zaiflashgan`,
    }
  }

  if (conflict && confidence < 65) {
    return {
      status: 'PENDING',
      validHours: 6,
      triggerCondition: `Manbalar kelishuvini kuting (${confidence}%) — ${direction} ssenariysini kuzating`,
    }
  }

  // Narx kirish darajasiga yaqinligini tekshirish (0.25% farq - ACTIVE)
  const entryDiffPct = Math.abs(currentPrice - entry) / entry
  if (entryDiffPct <= 0.0025 && entry > 0) {
    return {
      status: 'ACTIVE',
      validHours: 8,
      invalidateAbove: direction === 'BUY' ? sl : undefined,
      invalidateBelow: direction === 'SELL' ? sl : undefined,
    }
  }

  // PENDING: narx hali optimal zonaga yetmagan
  // Trigger zona: eng yaqin S/R zona yoki entry atrofidagi zona
  const relevantZones = snrZones.filter(z => {
    if (direction === 'BUY') return z.type === 'support' && z.priceTop < currentPrice
    return z.type === 'resistance' && z.priceBottom > currentPrice
  }).slice(0, 2)

  let triggerZone: { from: number; to: number } | undefined
  let triggerCondition: string

  if (relevantZones.length > 0) {
    const zone = relevantZones[0]
    triggerZone = { from: zone.priceBottom, to: zone.priceTop }

    // MUHIM: entry trigger zona chegarasiga mos bo'lishi SHART
    // BUY PENDING  → entry = support top (zone.priceTop),   SL = support bottom - buffer
    // SELL PENDING → entry = resistance bottom (zone.priceBottom), SL = resistance top + buffer
    const buffer = Math.abs(zone.priceTop - zone.priceBottom) * 0.3
    let adjustedEntry: number
    let adjustedSl: number

    if (direction === 'BUY') {
      adjustedEntry = +zone.priceTop.toFixed(5)
      adjustedSl    = +(zone.priceBottom - buffer).toFixed(5)
      triggerCondition = `Narx ${zone.priceBottom.toFixed(2)}–${zone.priceTop.toFixed(2)} support zonasiga pullback qilganda BUY`
    } else {
      adjustedEntry = +zone.priceBottom.toFixed(5)
      adjustedSl    = +(zone.priceTop + buffer).toFixed(5)
      triggerCondition = `Narx ${zone.priceBottom.toFixed(2)}–${zone.priceTop.toFixed(2)} resistance zonasiga ko'tarilganda SELL`
    }

    // Bekor qilish darajalari (adjusted asosida)
    const adjRisk = Math.abs(adjustedEntry - adjustedSl)
    const invalidateAboveFinal = direction === 'SELL' ? +(adjustedSl + adjRisk * 0.3).toFixed(5) : undefined
    const invalidateBelowFinal = direction === 'BUY'  ? +(adjustedSl - adjRisk * 0.3).toFixed(5) : undefined

    return {
      status: 'PENDING',
      triggerZone,
      triggerCondition,
      validHours: 12,
      adjustedEntry,
      adjustedSl,
      invalidateAbove: invalidateAboveFinal,
      invalidateBelow: invalidateBelowFinal,
    }
  } else {
    // Zona topilmadi — entry atrofidagi spread
    const spread = currentPrice * 0.002
    triggerZone = { from: entry - spread, to: entry + spread }
    triggerCondition = direction === 'BUY'
      ? `Narx ${(entry - spread).toFixed(2)}–${entry.toFixed(2)} zonasiga yetganda BUY`
      : `Narx ${entry.toFixed(2)}–${(entry + spread).toFixed(2)} zonasiga yetganda SELL`
  }

  // Bekor qilish darajalari (original entry uchun)
  const risk = Math.abs(entry - sl)
  const invalidateAbove = direction === 'SELL' ? (triggerZone.to + risk * 0.5) : undefined
  const invalidateBelow = direction === 'BUY' ? (triggerZone.from - risk * 0.5) : undefined

  return {
    status: 'PENDING',
    triggerZone,
    triggerCondition,
    validHours: 12,
    invalidateAbove: invalidateAbove ? parseFloat(invalidateAbove.toFixed(5)) : undefined,
    invalidateBelow: invalidateBelow ? parseFloat(invalidateBelow.toFixed(5)) : undefined,
  }
}

// ─── Chuqur Bozor Tahlili Yaratish ───────────────────────────────
export function buildDeepAnalysis(
  ind: IndicatorResult,
  smc: SMCResult | null,
  confluenceScore: number,
  confluenceComponents: Record<string, number>,
  currentPrice: number,
  snrZones: SNRZone[],
  trend: 'up' | 'down' | 'sideways',
): ChatSignalData['deepAnalysis'] {
  // RSI holati
  const rsiVal = (ind.rsi as { value?: number | null; period?: number } & { value: number | null }).value ?? 50
  const rsiState: 'overbought' | 'oversold' | 'neutral' =
    rsiVal >= 70 ? 'overbought' : rsiVal <= 30 ? 'oversold' : 'neutral'

  // MACD holati
  const macdHist = ind.macd.histogram ?? 0
  const macdVal = ind.macd.macd ?? 0
  const macdSig = ind.macd.signal ?? 0
  const macdCross = macdVal > macdSig
  const macdGrowing = macdHist > 0
  const macdState = macdCross && macdGrowing ? 'Bullish cross, histogram o\'syapti'
    : macdCross && !macdGrowing ? 'Bullish lekin zaiflashmoqda'
    : !macdCross && !macdGrowing ? 'Bearish cross, pastlashmoqda'
    : 'Bearish lekin kuchaymoqda'

  // EMA tartibi
  const ema20 = ind.ema.find(e => e.period === 20)?.value ?? null
  const ema50 = ind.ema.find(e => e.period === 50)?.value ?? null
  const ema200 = ind.ema.find(e => e.period === 200)?.value ?? null
  let emaOrder: 'bullish' | 'bearish' | 'mixed' = 'mixed'
  if (ema20 && ema50 && ema200) {
    if (ema20 > ema50 && ema50 > ema200) emaOrder = 'bullish'
    else if (ema20 < ema50 && ema50 < ema200) emaOrder = 'bearish'
  }

  // ATR darajasi
  const atrVal = (ind.atr as { value?: number | null }).value ?? 0
  const priceRangeRatio = atrVal / currentPrice
  const atrLevel: 'low' | 'medium' | 'high' =
    priceRangeRatio < 0.005 ? 'low' : priceRangeRatio < 0.015 ? 'medium' : 'high'

  // ADX kuchi
  const adxVal = ind.adx.adx ?? 20
  const adxStrength: 'weak' | 'trend' | 'strong' =
    adxVal < 20 ? 'weak' : adxVal < 40 ? 'trend' : 'strong'

  // Narx pozitsiyasi
  const nearSupport = snrZones.find(z => z.type === 'support' && z.priceTop >= currentPrice * 0.998)
  const nearResistance = snrZones.find(z => z.type === 'resistance' && z.priceBottom <= currentPrice * 1.002)
  let pricePosition = 'Zona orasida (no man\'s land)'
  if (nearSupport && nearResistance) pricePosition = 'Support va resistance orasida'
  else if (nearSupport) pricePosition = 'Support zonasida (pullback opportunity)'
  else if (nearResistance) pricePosition = 'Resistance zonasida (ehtiyot bo\'ling)'

  // SMC ma'lumotlari
  const lastBOSDirection = smc?.lastBOS?.direction ?? null
  const activeFVG = (smc?.fvgZones?.filter(f => !f.filled).length ?? 0) > 0

  // Momentum (RSI + MACD kombinatsiyasi)
  let momentum: 'strengthening' | 'weakening' | 'reversing' | 'neutral' = 'neutral'
  if (rsiVal > 55 && macdGrowing) momentum = 'strengthening'
  else if (rsiVal < 45 && !macdGrowing) momentum = 'weakening'
  else if ((rsiState === 'overbought' && !macdGrowing) || (rsiState === 'oversold' && macdGrowing)) momentum = 'reversing'

  // Trend matn
  const trendStr = trend === 'up' ? 'bullish' : trend === 'down' ? 'bearish' : 'sideways'

  // Ssenariylar — joriy narxga nisbatan to'g'ri filterlash (MUHIM: support pastda, resistance ustida bo'lishi shart)
  const supBelow = snrZones
    .filter(z => z.type === 'support' && z.priceTop < currentPrice * 1.001)
    .sort((a, b) => b.priceTop - a.priceTop)  // eng yaqin yuqorida

  const resAbove = snrZones
    .filter(z => z.type === 'resistance' && z.priceBottom > currentPrice * 0.999)
    .sort((a, b) => a.priceBottom - b.priceBottom) // eng yaqin pastda

  const nearSup = supBelow[0]   // eng yaqin support (pastda)
  const nearRes = resAbove[0]   // eng yaqin resistance (ustida)
  const nextSup = supBelow[1]   // ikkinchi support (bear target uchun)

  // Bull ssenariy: narx supportni ushlab → resistance ga YUQORIga
  const bullHold   = nearSup ? nearSup.priceTop.toFixed(2)    : (currentPrice * 0.998).toFixed(2)
  const bullTarget = nearRes ? nearRes.priceBottom.toFixed(2) : (currentPrice * 1.01).toFixed(2)
  const bullStop   = nearSup ? nearSup.priceBottom.toFixed(2) : (currentPrice * 0.995).toFixed(2)

  // Bear ssenariy: narx supportni sindirsa → keyingi support ga PASTga (stop support ustida)
  const bearBreak  = nearSup ? nearSup.priceBottom.toFixed(2) : (currentPrice * 0.997).toFixed(2)
  const bearTarget = nextSup
    ? nextSup.priceTop.toFixed(2)
    : nearSup
      ? (nearSup.priceBottom * 0.997).toFixed(2)
      : (currentPrice * 0.99).toFixed(2)
  const bearStop   = nearRes ? nearRes.priceBottom.toFixed(2) : (currentPrice * 1.005).toFixed(2)

  return {
    trend: trendStr as 'bullish' | 'bearish' | 'sideways',
    pricePosition,
    momentum,
    rsi: { value: Math.round(rsiVal), state: rsiState },
    macd: { state: macdState },
    emaOrder,
    atr: { level: atrLevel },
    adx: { value: Math.round(adxVal), strength: adxStrength },
    lastBOSDirection,
    activeFVG,
    confluenceScore,
    scenarios: {
      bull: `Narx ${bullHold} supportni ushlab qolsa → ${bullTarget} ga YUQORIga harakat. Stop: ${bullStop}`,
      bear: `Narx ${bearBreak} supportni sindirsa → ${bearTarget} ga tushishi mumkin. Stop: ${bearStop}`,
    },
  }
}
