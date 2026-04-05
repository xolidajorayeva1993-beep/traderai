// ============================================================
// FATH AI Chat API Route
// GPT-4o primary  Gemini fallback (auto)
// Admin strategiya: Firestore /prompts/{name=signal_analysis}
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { FailoverDataProvider } from '@/lib/data/DataProvider'
import { TwelveDataAdapter } from '@/lib/data/TwelveDataAdapter'
import { YahooFinanceAdapter } from '@/lib/data/YahooFinanceAdapter'
import { BinanceAdapter } from '@/lib/data/BinanceAdapter'
import { withOHLCVCache } from '@/lib/ohlcvCache'
import { generateChartSVG } from '@/lib/analysis/chartRenderer'
import type { Levels } from '@/lib/analysis/chartRenderer'
import { svgToPngBase64 } from '@/lib/ai/svgToImage'
import type { FullAnalysisResult } from '@/lib/analysis/types'
import { calculateIndicators } from '@/lib/analysis/indicators'
import { calculateSNR, analyzeSMC, analyzeTrendlines } from '@/lib/analysis'
import { determineSignalStatus, buildDeepAnalysis } from '@/lib/ai/FathAIConsensus'
import type { ChatSignalData } from '@/lib/ai/types'
import type { SNRResult, SMCResult, TrendlineResult, IndicatorResult } from '@/lib/analysis/types'

const NullableNumber = z.number().finite().nullable()

const StructuredSignalSchema = z.object({
  direction: z.enum(['BUY', 'SELL', 'NEUTRAL']),
  entry: NullableNumber,
  sl: NullableNumber,
  tp1: NullableNumber,
  tp2: NullableNumber,
  tp3: NullableNumber,
  rr: NullableNumber,
  confidence: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(4000),
  mtf: z.object({
    higherTimeframeBias: z.string().max(100).nullable(),
    executionTimeframeBias: z.string().max(100).nullable(),
    alignment: z.enum(['ALIGNED', 'MIXED', 'CONFLICT']).nullable(),
  }),
  confluenceScore: NullableNumber,
  backtest: z.object({
    summary: z.string().max(1000).nullable(),
    winRate: NullableNumber,
    sampleSize: NullableNumber,
  }),
})

const StructuredAIResponseSchema = z.object({
  reply: z.string().min(1).max(6000),
  signal: StructuredSignalSchema.nullable(),
})

type StructuredSignal = z.infer<typeof StructuredSignalSchema>
type StructuredAIResponse = z.infer<typeof StructuredAIResponseSchema>

const OPENAI_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'fath_ai_chat_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['reply', 'signal'],
      properties: {
        reply: { type: 'string' },
        signal: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              additionalProperties: false,
              required: [
                'direction', 'entry', 'sl', 'tp1', 'tp2', 'tp3', 'rr',
                'confidence', 'reasoning', 'mtf', 'confluenceScore', 'backtest',
              ],
              properties: {
                direction: { type: 'string', enum: ['BUY', 'SELL', 'NEUTRAL'] },
                entry: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                sl: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                tp1: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                tp2: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                tp3: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                rr: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                confidence: { type: 'number', minimum: 0, maximum: 100 },
                reasoning: { type: 'string' },
                mtf: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['higherTimeframeBias', 'executionTimeframeBias', 'alignment'],
                  properties: {
                    higherTimeframeBias: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                    executionTimeframeBias: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                    alignment: { anyOf: [{ type: 'string', enum: ['ALIGNED', 'MIXED', 'CONFLICT'] }, { type: 'null' }] },
                  },
                },
                confluenceScore: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                backtest: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['summary', 'winRate', 'sampleSize'],
                  properties: {
                    summary: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                    winRate: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    sampleSize: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
} as const

//  Data providers
const CRYPTO_SYMBOLS = new Set(['BTCUSDT','BTCUSD','ETHUSDT','ETHUSD','BNBUSD'])
const forexProvider = new FailoverDataProvider([
  new TwelveDataAdapter(),
  new YahooFinanceAdapter(),
])
const cryptoProvider = new FailoverDataProvider([
  new BinanceAdapter(),
  new YahooFinanceAdapter(),
])

//  Symbol / Timeframe detector
const KNOWN_SYMBOLS = [
  'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD',
  'EURGBP','EURJPY','GBPJPY','XAUUSD','XAGUSD','USOIL',
  'BTCUSDT','BTCUSD','ETHUSDT','ETHUSD','BNBUSD',
  'US30','SPX500','NAS100',
]
const TF_MAP: Record<string,string> = {
  'M1':'1m','M5':'5m','M15':'15m','M30':'30m',
  'H1':'1h','H4':'4h','D1':'1d','W1':'1w',
  '1M':'1m','5M':'5m','15M':'15m','30M':'30m',
  '1H':'1h','4H':'4h','1D':'1d','1W':'1w',
}

// Signal so'rovi yoki umumiy savol ekanini aniqlash
function isSignalRequest(message: string): boolean {
  const up = message.toUpperCase()
  // Umumiy savollar — signal SHART EMAS
  const generalPatterns = [
    'RISK', 'LOT', 'POZITSIYA HAJMI', 'POSITION SIZE',
    'YANGILIK', 'NEWS', 'XABAR', 'NIMA BO', 'TUSHUNTIR',
    'HISOBLA', 'HISOB', 'NIMA', 'QANDAY', 'NIMA UCHUN',
    'STRATEGIYA NIMA', 'STRATEGIYANI TUSHUNTIR',
    'FOIZ', 'FOYDALI', 'ZARARLI', 'KAPITAL',
  ]
  const signalPatterns = [
    'SIGNAL', 'TAHLI', 'TAHLIL', 'ANALIZ', 'ANALYS',
    'ENTRY', 'KIRISH NUQTASI', 'SL', 'TP', 'STOP',
    'SETUP', 'TRADE QIL', 'SOTIB OL', 'SOT ', 'BUY ',
    'SELL ', 'SAVDO ', 'POZITSIYA OCH',
  ]
  const hasSignal  = signalPatterns.some(k => up.includes(k))
  const hasGeneral = generalPatterns.some(k => up.includes(k))
  // Agar aniq signal so'rovi bo'lsa — ha
  if (hasSignal) return true
  // Agar faqat umumiy savol bo'lsa — yo'q
  if (hasGeneral) return false
  // Default: agar symbol aniqlangan bo'lsa — signal deb hisoblaylik
  return true
}

function detectRequest(message: string): { symbol: string; timeframe: string } | null {
  const up = message.toUpperCase()
  let sym: string | null = null
  for (const s of KNOWN_SYMBOLS) {
    if (up.includes(s)) { sym = s; break }
  }
  if (!sym) {
    if (up.includes('GOLD') || up.includes('OLTIN') || up.includes('XAU')) sym = 'XAUUSD'
    else if (up.includes('BTC') || up.includes('BITCOIN')) sym = 'BTCUSDT'
    else if (up.includes('ETH') || up.includes('ETHEREUM')) sym = 'ETHUSDT'
    else if (up.includes('OIL') || up.includes('NEFT')) sym = 'USOIL'
  }
  if (!sym) return null
  let tf = '1h'
  for (const [key,val] of Object.entries(TF_MAP)) {
    if (up.includes(key)) { tf = val; break }
  }
  const tfMatch = message.match(/\b(1m|5m|15m|30m|1h|4h|1d|1w)\b/i)
  if (tfMatch) tf = tfMatch[1].toLowerCase()
  return { symbol: sym, timeframe: tf }
}

function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

function parseStructuredAIResponse(raw: string): StructuredAIResponse {
  const candidate = extractJsonCandidate(raw)
  let parsed: unknown

  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new Error('AI strukturali JSON yubormadi')
  }

  const validated = StructuredAIResponseSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error('AI JSON sxemaga mos emas')
  }

  return validated.data
}

function buildLevelsFromSignal(signal: StructuredSignal, currentPrice: number): Levels | null {
  if (signal.sl == null || signal.tp1 == null) return null

  const entry = signal.entry ?? currentPrice
  const tp2 = signal.tp2 ?? signal.tp1
  const tp3 = signal.tp3 ?? tp2
  const rr = signal.rr ?? Math.abs(signal.tp1 - entry) / Math.max(Math.abs(entry - signal.sl), 0.0001)

  return {
    entry,
    sl: signal.sl,
    tp1: signal.tp1,
    tp2,
    tp3,
    rr,
  }
}

//  Minimal FullAnalysisResult stub
function emptyAnalysis(): FullAnalysisResult {
  return {
    indicators: { rsi: { value: 50 }, macd: { macd: 0, signal: 0, histogram: 0 }, atr: { value: 0 }, ema: [] },
    snr: { supports: [], resistances: [], nearestSupport: null, nearestResistance: null },
    fibonacci: { retracementLevels: [], swingHigh: 0, swingLow: 0 },
    patterns: { patterns: [] },
    trendline: { mainTrend: 'sideways', shortTrend: 'sideways' },
    confluence: { finalScore: 0, direction: 'NEUTRAL', components: { indicators: 0, snr: 0, patterns: 0, trendline: 0, fibonacci: 0, gann: 0, smc: 0 } },
    smc: { lastBOS: null, fvgs: [], orderBlocks: [] },
    gann: {},
  } as unknown as FullAnalysisResult
}

// ─── Signal Data Builder ──────────────────────────────────────────────────────
// Separate function so TypeScript uses declared param types, not outer-scope narrowing
function buildSignalData(
  signal: StructuredSignal | null,
  levels: Levels | null,
  symbol: string,
  timeframe: string,
  currentPrice: number,
  snrResult:   SNRResult | null,
  smcResult:   SMCResult | null,
  trendResult: TrendlineResult | null,
  indResult:   IndicatorResult | null,
): ChatSignalData {
  const snrZones = snrResult?.zones ?? []
  const trend    = trendResult?.mainTrend ?? 'sideways'
  const fallbackConfidence = Math.min(100, Math.max(40,
    ((snrResult?.score ?? 50) + (trendResult?.trendStrength ?? 50)) / 2
  ))
  const confidence = Math.round(signal?.confidence ?? fallbackConfidence)
  const confluence = Math.round(signal?.confluenceScore ?? confidence)
  const effectiveInd = indResult ?? {
    ema: [], rsi: { value: 50, period: 14 }, macd: { macd: 0, signal: 0, histogram: 0 },
    sma: [], atr: { value: 0, period: 14 }, adx: { adx: 20, pdi: 20, mdi: 20 },
    bollingerBands: { upper: null, middle: null, lower: null, bandwidth: null },
    stochastic: { k: null, d: null }, obv: null, vwap: null, signal: 'NEUTRAL' as const, score: 0,
  } as IndicatorResult

  const deepAnal = buildDeepAnalysis(effectiveInd, smcResult, confluence, {}, currentPrice, snrZones, trend)

  // NEUTRAL yoki signal yo'q → SNR zonalardan PENDING signal qurish
  if (!signal || signal.direction === 'NEUTRAL' || !levels) {
    const atrVal = (indResult?.atr as { value?: number } | null)?.value ?? currentPrice * 0.01

    // Joriy narxga nisbatan eng yaqin support (pastda) va resistance (ustida)
    const supBelow = snrZones
      .filter(z => z.type === 'support' && z.priceTop < currentPrice * 1.001)
      .sort((a, b) => b.priceTop - a.priceTop)
    const resAbove = snrZones
      .filter(z => z.type === 'resistance' && z.priceBottom > currentPrice * 0.999)
      .sort((a, b) => a.priceBottom - b.priceBottom)

    const nearSup = supBelow[0]
    const nearRes = resAbove[0]

    // Support yaqinmi yoki resistance yaqinmi?
    const distToSup = nearSup ? currentPrice - nearSup.priceTop : Infinity
    const distToRes = nearRes ? nearRes.priceBottom - currentPrice : Infinity

    let pendingDir: 'BUY' | 'SELL'
    let pendingEntry: number, pendingSL: number
    let pendingTP1: number, pendingTP2: number, pendingTP3: number
    let triggerZone: { from: number; to: number }
    let triggerCondition: string

    if (nearSup && (!nearRes || distToSup <= distToRes)) {
      // Support yaqin → BUY bounce pending
      pendingDir    = 'BUY'
      pendingEntry  = nearSup.priceTop
      pendingSL     = nearSup.priceBottom
      pendingTP1    = nearRes ? nearRes.priceBottom : pendingEntry + atrVal * 2
      pendingTP2    = nearRes ? nearRes.priceTop    : pendingEntry + atrVal * 3.5
      pendingTP3    = pendingTP2 + atrVal
      triggerZone   = { from: +nearSup.priceBottom.toFixed(5), to: +nearSup.priceTop.toFixed(5) }
      triggerCondition = `Narx ${nearSup.priceBottom.toFixed(2)}–${nearSup.priceTop.toFixed(2)} support zonasiga pullback qilganda BUY`
    } else if (nearRes) {
      // Resistance yaqin → SELL rejection pending
      pendingDir    = 'SELL'
      pendingEntry  = nearRes.priceBottom
      pendingSL     = nearRes.priceTop
      pendingTP1    = nearSup ? nearSup.priceTop    : pendingEntry - atrVal * 2
      pendingTP2    = nearSup ? nearSup.priceBottom : pendingEntry - atrVal * 3.5
      pendingTP3    = pendingTP2 - atrVal
      triggerZone   = { from: +nearRes.priceBottom.toFixed(5), to: +nearRes.priceTop.toFixed(5) }
      triggerCondition = `Narx ${nearRes.priceBottom.toFixed(2)}–${nearRes.priceTop.toFixed(2)} resistance zonasiga ko'tarilganda SELL`
    } else {
      // Hech qanday zona yo'q → ATR asosida BUY pending
      pendingDir    = 'BUY'
      pendingEntry  = +(currentPrice * 0.998).toFixed(5)
      pendingSL     = +(currentPrice - atrVal * 1.5).toFixed(5)
      pendingTP1    = +(currentPrice + atrVal * 2).toFixed(5)
      pendingTP2    = +(currentPrice + atrVal * 3.5).toFixed(5)
      pendingTP3    = +(currentPrice + atrVal * 5.5).toFixed(5)
      triggerZone   = { from: +(pendingEntry - atrVal * 0.3).toFixed(5), to: +pendingEntry.toFixed(5) }
      triggerCondition = `Narx ${pendingEntry.toFixed(2)} darajasiga pullback qilganda BUY`
    }

    const rr = Math.abs(pendingTP2 - pendingEntry) / Math.max(0.0001, Math.abs(pendingEntry - pendingSL))

    return {
      status:           'PENDING',
      symbol,
      timeframe,
      direction:        pendingDir,
      confidence:       Math.min(confidence, 48),
      entry:            pendingEntry,
      sl:               pendingSL,
      tp1:              pendingTP1,
      tp2:              pendingTP2,
      tp3:              pendingTP3,
      rr:               +rr.toFixed(1),
      triggerZone,
      triggerCondition,
      validHours:       8,
      engineScores: {
        visionEngine: Math.min(100, confidence + 5),
        marketEngine: confidence,
        mathEngine:   Math.round(snrResult?.score ?? confidence),
      },
      deepAnalysis: deepAnal,
    }
  }

  const statusRes = determineSignalStatus(
    signal.direction, confidence, false, currentPrice,
    levels.entry, levels.sl, levels.tp1, snrZones, confluence,
  )

  // PENDING holatida: adjustedEntry/adjustedSl trigger zona bilan mos bo'lishi kerak
  // TP larni ham adjusted entry ga nisbatan qayta hisoblaymiz
  let finalEntry = levels.entry
  let finalSl    = levels.sl
  let finalTp1   = levels.tp1
  let finalTp2   = levels.tp2
  let finalTp3   = levels.tp3

  if (statusRes.status === 'PENDING' && statusRes.adjustedEntry && statusRes.adjustedSl) {
    finalEntry = statusRes.adjustedEntry
    finalSl    = statusRes.adjustedSl

    // TP larni AI bergan nisbatga asoslab adjusted entry dan qayta joylashtiramiz
    const origRisk   = Math.abs(levels.entry - levels.sl)
    const origTp1Dist = Math.abs(levels.tp1 - levels.entry)
    const origTp2Dist = Math.abs(levels.tp2 - levels.entry)
    const origTp3Dist = Math.abs(levels.tp3 - levels.entry)

    // Nisbatni saqlab, adjusted entry dan hisoblash
    // BUY: TP yuqorida; SELL: TP pastda
    const sign = signal.direction === 'BUY' ? 1 : -1
    // Masshtab koeffitsienti: adjusted risk / original risk
    const newRisk = Math.abs(finalEntry - finalSl)
    const scale   = origRisk > 0 ? newRisk / origRisk : 1

    finalTp1 = +(finalEntry + sign * origTp1Dist * scale).toFixed(5)
    finalTp2 = +(finalEntry + sign * origTp2Dist * scale).toFixed(5)
    finalTp3 = +(finalEntry + sign * origTp3Dist * scale).toFixed(5)
  }

  const finalRr = Math.abs(finalTp2 - finalEntry) / Math.max(0.0001, Math.abs(finalEntry - finalSl))

  return {
    status:           statusRes.status !== 'NO_TRADE' ? statusRes.status : 'PENDING',
    symbol,
    timeframe,
    direction:        signal.direction,
    confidence,
    entry:            finalEntry,
    sl:               finalSl,
    tp1:              finalTp1,
    tp2:              finalTp2,
    tp3:              finalTp3,
    rr:               +finalRr.toFixed(1),
    triggerZone:      statusRes.triggerZone,
    triggerCondition: statusRes.triggerCondition,
    validHours:       statusRes.validHours,
    invalidateAbove:  statusRes.invalidateAbove,
    invalidateBelow:  statusRes.invalidateBelow,
    nextCheckTime:    statusRes.nextCheckTime,
    engineScores: {
      visionEngine: Math.min(100, confidence + 5),
      marketEngine: confidence,
      mathEngine:   Math.round(snrResult?.score ?? confluence),
    },
    deepAnalysis: deepAnal,
  }
}

//  Base system prompt (fallback agar admin prompt yo'q bo'lsa)
const BASE_SYSTEM = `Sen FATH AI — professional AI trading yordamchisi.

ASOSIY QOIDALAR:
- Hech qachon "OpenAI", "GPT", "ChatGPT", "Gemini" dema. O'zing nomingni so'rashsa: "Men FATH AI".
- Faqat Forex va Kripto bozor haqida gapir.
- Javoblar O'zbek tilida (foydalanuvchi inglizcha so'rasa, inglizcha javob ber).
- Har bir javobda mavzuga mos emoji ishlatilsin.

ATR ASOSIDA REALISTIK BASHORAT (ENG MUHIM QOIDA):
- Senga BOZOR MA'LUMOTLARI blokida ATR va haftalik diapazon beriladi.
- SL va TP masofasi HECH QACHON ATR dan kichik bo'lmasligi kerak.
- TP1 = kamida ATR × 2.0, TP2 = ATR × 3.5, TP3 = ATR × 5.5
- Haftalik bashorat so'ralsa: narx diapazoni = D1 ATR × 5 (kamida)
- "Bozor hafta davomida 50-100 nuqta harakatlanadi" emas, ATR dan hisoblangan aniq raqam ber.

TREND TAHLILI QOIDASI:
- ADX > 25 = Trend kuchli, trend bo'yicha savdo qil
- ADX < 20 = Sideways, noaniq, ogohlantir
- +DI > -DI = Bullish, -DI > +DI = Bearish
- RSI > 70 = Overbought (sell pressure), RSI < 30 = Oversold (buy pressure)
- EMA50 va EMA200 ga nisbatan narx holati — har doim aytib o't

MOMENTUM TAHLILI:
- MACD Histogram musbat va oshyapdi = Kuchli bullish momentum
- MACD Histogram manfiy va kamayapdi = Kuchli bearish momentum
- Bollinger Bands yuqori band = Resistance, quyi = Support
- Narx BB yuqori banddan oshsa = Overbought signal

SIGNAL FORMATI (signal berganda DOIM shu formatda yoz):
HAR DOIM FAQAT JSON qaytar. Markdown, code fence yoki qo'shimcha matn yozma.

JSON SXEMA:
{
  "reply": "foydalanuvchiga ko'rinadigan professional javob",
  "signal": {
    "direction": "BUY | SELL | NEUTRAL",
    "entry": number | null,
    "sl": number | null,
    "tp1": number | null,
    "tp2": number | null,
    "tp3": number | null,
    "rr": number | null,
    "confidence": number,
    "reasoning": "signal sababi yoki no-trade izohi",
    "mtf": {
      "higherTimeframeBias": "bullish | bearish | sideways | null",
      "executionTimeframeBias": "bullish | bearish | sideways | null",
      "alignment": "ALIGNED | MIXED | CONFLICT | null"
    },
    "confluenceScore": number | null,
    "backtest": {
      "summary": "qisqa izoh yoki null",
      "winRate": number | null,
      "sampleSize": number | null
    }
  }
}

QOIDALAR:
- Signal FAQAT foydalanuvchi tahlil, signal, entry/sl/tp, kirish nuqtasi so'ragan holda qaytariladi.
- Umumiy savollar (risk menejment, lot hisoblash, yangiliklar, strategiya tushuntirish, iqtisodiy savollar) uchun signal: NULL bo'lishi SHART. Bu hollarda matnli javob ber, signal yaratma.
- Signal so'ralganda: direction = "BUY" yoki "SELL", entry/sl/tp1 ALBATTA aniq raqam bo'lsin.
- Signal bo'lsa, SL va TP darajalari mantiqan to'g'ri bo'lsin:
  * BUY signalida: SL < Entry < TP1 < TP2 < TP3
  * SELL signalida: TP3 < TP2 < TP1 < Entry, SL > Entry
- reply ichida ichki model yoki provider nomlarini tilga olma.
- reply qisqa, professional, foydalanuvchiga tayyor matn bo'lsin.

Bu ta'limiy maqsadda. Haqiqiy moliyaviy maslahat emas.`

//  Admin strategiyasini Firestore dan olish
//  Kesh: 20 soniya (admin saqlagandan tez ishga tushadi)
let cachedStrategy: { content: string; ts: number } | null = null
const STRATEGY_TTL = 20 * 1000   // 20 soniya

async function getAdminStrategy(): Promise<string> {
  // Kesh yangi bo'lsa qayt
  if (cachedStrategy && Date.now() - cachedStrategy.ts < STRATEGY_TTL) {
    return cachedStrategy.content
  }
  try {
    const { initAdmin } = await import('@/lib/firebase/admin')
    const { getFirestore } = await import('firebase-admin/firestore')
    initAdmin()
    const db = getFirestore()

    // 1-urinish: enabled=true bo'lgan signal_analysis
    const snap = await db.collection('prompts')
      .where('name', '==', 'signal_analysis')
      .where('enabled', '==', true)
      .limit(1)
      .get()

    if (!snap.empty) {
      const data = snap.docs[0].data() as { content: string }
      console.log('[getAdminStrategy] Admin prompt yuklandi (%d belgi)', data.content.length)
      cachedStrategy = { content: data.content, ts: Date.now() }
      return data.content
    }

    // 2-urinish: enabled qiymati har qanday bo'lsin
    const snap2 = await db.collection('prompts')
      .where('name', '==', 'signal_analysis')
      .limit(1)
      .get()

    if (!snap2.empty) {
      const data = snap2.docs[0].data() as { content: string; enabled?: boolean }
      console.warn('[getAdminStrategy] signal_analysis topildi lekin enabled=false — Firestore prompti ishlatilmoqda.')
      cachedStrategy = { content: data.content, ts: Date.now() }
      return data.content
    }

    console.warn('[getAdminStrategy] Firestoarda signal_analysis topilmadi — default prompt ishlatilmoqda.')
  } catch (e) {
    console.error('[getAdminStrategy] Firestore xatosi:', e)
  }
  return BASE_SYSTEM
}

// Admin AI sozlamalari (5 daqiqa kesh)
interface AdminSettings {
  temperature:     number
  maxTokens:       number
  topP:            number
  minConfluence:   number
  strongThreshold: number
  conflictTol:     number
  techVsFundamental: number
  strategyWeights: Record<string, number>
  strategyActives: Record<string, boolean>
  primaryAiModel:  string
}
const DEFAULT_AI_SETTINGS: AdminSettings = {
  temperature: 0.7, maxTokens: 1200, topP: 0.95,
  minConfluence: 60, strongThreshold: 75, conflictTol: 20, techVsFundamental: 60,
  strategyWeights: { indicators: 20, snr: 25, patterns: 15, trendline: 15, fibonacci: 10, gann: 5, smc: 10 },
  strategyActives: { indicators: true, snr: true, patterns: true, trendline: true, fibonacci: true, gann: true, smc: true },
  primaryAiModel: 'gpt-4o-mini',
}
let cachedAiSettings: { data: AdminSettings; ts: number } | null = null
const SETTINGS_TTL = 5 * 60 * 1000

async function getAdminSettings(): Promise<AdminSettings> {
  try {
    if (cachedAiSettings && Date.now() - cachedAiSettings.ts < SETTINGS_TTL) {
      return cachedAiSettings.data
    }
    const { initAdmin } = await import('@/lib/firebase/admin')
    const { getFirestore } = await import('firebase-admin/firestore')
    initAdmin()
    const db = getFirestore()
    const doc = await db.collection('settings').doc('main').get()
    if (doc.exists) {
      const raw = doc.data() as {
        aiParams?: Partial<AdminSettings>
        strategyWeights?: Record<string, number>
        strategyActives?: Record<string, boolean>
        primaryAiModel?: string
      }
      const merged: AdminSettings = {
        ...DEFAULT_AI_SETTINGS,
        ...(raw.aiParams ?? {}),
        strategyWeights: raw.strategyWeights ?? DEFAULT_AI_SETTINGS.strategyWeights,
        strategyActives: raw.strategyActives ?? DEFAULT_AI_SETTINGS.strategyActives,
        primaryAiModel:  raw.primaryAiModel  ?? DEFAULT_AI_SETTINGS.primaryAiModel,
      }
      cachedAiSettings = { data: merged, ts: Date.now() }
      return merged
    }
  } catch { /* Firestore xatosi — default ishlatamiz */ }
  return DEFAULT_AI_SETTINGS
}

// Strategiya og'irliklarini prompt matniga aylantirish
function buildStrategyContext(settings: AdminSettings): string {
  const STRATEGY_LABELS: Record<string, string> = {
    indicators: 'Texnik Indikatorlar (RSI/MACD/EMA)',
    snr:        'SNR Support & Resistance',
    patterns:   'Chart Patterns',
    trendline:  'Trendline Analiz',
    fibonacci:  'Fibonacci',
    gann:       'Gann Analiz',
    smc:        'Smart Money (SMC/BOS/FVG)',
  }
  const activeKeys = Object.entries(settings.strategyActives)
    .filter(([, v]) => v)
    .map(([k]) => k)
  if (!activeKeys.length) return ''

  const weightLines = activeKeys
    .map(k => `  - ${STRATEGY_LABELS[k] ?? k}: ${settings.strategyWeights[k] ?? 0}% og'irlik`)
    .join('\n')

  const techPct  = settings.techVsFundamental
  const fundPct  = 100 - techPct
  return `
[TAHLIL PARAMETRLARI]
Faol strategiyalar va og'irliklari:
${weightLines}
Minimal confluence bali: ${settings.minConfluence}% (bu dan past signal berma)
Kuchli signal chegarasi: ${settings.strongThreshold}% (bu dan yuqori bo'lsa "STRONG" deb belgilagin)
Texnik/Fundamental nisbat: Texnik ${techPct}% / Fundamental ${fundPct}%
`
}

//  Schema
const RequestSchema = z.object({
  message:      z.string().min(1).max(2000),
  userId:       z.string().min(1).max(128).optional(),
  history:      z.array(z.object({
    role:    z.enum(['user','assistant']),
    content: z.string().max(4000),
  })).max(10).optional(),
  imageBase64:   z.string().max(8_000_000).optional(),
  imageMimeType: z.enum(['image/jpeg','image/png','image/webp','image/gif']).optional(),
})

// ─── Plan Limit Checker + Usage Tracker ──────────────────────────────────────
const PLAN_DEFAULT_LIMITS: Record<string, number> = { free: 10, pro: 100, vip: 500 }
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

async function checkAndIncrementUsage(uid: string): Promise<{ blocked: boolean; reason?: string }> {
  console.log('[usage] START uid=', uid)
  try {
    const { initAdmin } = await import('@/lib/firebase/admin')
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
    initAdmin()
    const db = getFirestore()

    // User va plan ma'lumotlarini parallel olamiz
    const [userDoc, plansSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('plans').get(),
    ])
    // Firestore Timestamp → number konversiyasi
    function toMs(val: unknown): number | undefined {
      if (typeof val === 'number') return val
      if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function')
        return (val as { toMillis: () => number }).toMillis()
      if (val instanceof Date) return val.getTime()
      return undefined
    }

    const rawUser = userDoc.exists ? (userDoc.data() ?? {}) : {}
    if (!userDoc.exists) {
      console.log('[usage] user doc yo\'q — free limit bilan davom etamiz')
    }
    const user = {
      plan:            (rawUser as Record<string, unknown>).plan as string | undefined,
      planActivatedAt: toMs((rawUser as Record<string, unknown>).planActivatedAt),
      planExpiresAt:   toMs((rawUser as Record<string, unknown>).planExpiresAt),
      createdAt:       toMs((rawUser as Record<string, unknown>).createdAt),
    }
    const plan = user.plan ?? 'free'
    const now  = Date.now()

    // Plan limitini topamiz
    const planDoc = plansSnap.docs.find(d => (d.data() as { name?: string }).name === plan)
    const planLimits = planDoc?.data() as { limits?: { aiChatLimit?: number } } | undefined
    const monthlyLimit: number = planLimits?.limits?.aiChatLimit ?? PLAN_DEFAULT_LIMITS[plan] ?? 10
    console.log('[usage] plan=', plan, 'monthlyLimit=', monthlyLimit, 'planDocFound=', !!planDoc)

    // Mavjud usage doc ni avval o'qib olamiz (periodStart aniqlash uchun)
    const usageRef = db.collection('userUsage').doc(uid)
    const existingUsageDoc = await usageRef.get()
    const existingRaw = existingUsageDoc.exists ? (existingUsageDoc.data() ?? {}) : {}
    const existingPeriodStart = toMs((existingRaw as Record<string, unknown>).periodStart)

    // Davr boshlanishi
    let periodStart: number
    if (plan === 'free') {
      if (existingPeriodStart && (now - existingPeriodStart) < THIRTY_DAYS_MS) {
        // Hali 30 kun o'tmagan — saqlangan davr boshini ishlatamiz
        periodStart = existingPeriodStart
      } else {
        // Birinchi marta yoki yangi davr
        const base = user.createdAt ?? now
        periodStart = existingPeriodStart
          ? existingPeriodStart + Math.floor((now - existingPeriodStart) / THIRTY_DAYS_MS) * THIRTY_DAYS_MS
          : base
      }
    } else {
      periodStart = user.planActivatedAt
        ?? (user.planExpiresAt ? user.planExpiresAt - THIRTY_DAYS_MS : (user.createdAt ?? now))
      const periodEnd = periodStart + THIRTY_DAYS_MS
      if (now > periodEnd) {
        return {
          blocked: true,
          reason: 'Tarifingiz muddati tugagan. Yangi tarif sotib olish orqali faollashtiring.',
        }
      }
    }
    console.log('[usage] periodStart=', new Date(periodStart).toISOString(), 'existingPeriodStart=', existingPeriodStart ? new Date(existingPeriodStart).toISOString() : 'yo\'q')

    // Firestore transaction: atomik tekshirish va oshirish
    let blocked = false
    let finalUsed = 0

    await db.runTransaction(async (tx) => {
      const usageDoc = await tx.get(usageRef)
      const usageRaw = usageDoc.exists ? usageDoc.data() ?? {} : {}
      const storedPeriodStart = toMs((usageRaw as Record<string, unknown>).periodStart)
      const storedAiChatUsed  = (usageRaw as Record<string, unknown>).aiChatUsed

      // Bir xil davr bo'lsa — amaldagi hisobni olamiz, aks holda 0
      const aiChatUsed = storedPeriodStart === periodStart ? (typeof storedAiChatUsed === 'number' ? storedAiChatUsed : 0) : 0
      finalUsed = aiChatUsed
      console.log('[usage] storedPeriodStart=', storedPeriodStart, 'periodStart=', periodStart, 'aiChatUsed=', aiChatUsed, 'limit=', monthlyLimit)

      if (aiChatUsed >= monthlyLimit) { blocked = true; return }

      // Incrementing
      if (!usageDoc.exists || storedPeriodStart !== periodStart) {
        console.log('[usage] tx.set (yangi davr yoki hujjat yo\'q)')
        tx.set(usageRef, { uid, periodStart, aiChatUsed: 1, updatedAt: now })
      } else {
        console.log('[usage] tx.update (increment)')
        tx.update(usageRef, { aiChatUsed: FieldValue.increment(1), updatedAt: now })
      }
    })

    if (blocked) {
      return {
        blocked: true,
        reason: `Oylik AI chat limitingiz tugadi (${finalUsed}/${monthlyLimit} so'rov ishlatilgan). Tarif yangilash orqali davom eting.`,
      }
    }
    console.log('[usage] OK, blocked=false')
    return { blocked: false }
  } catch (err) {
    console.error('[usage] TRANSACTION XATO:', err)
    return { blocked: false } // Xato bo'lsa — bloklamaylik
  }
}


async function callGPT(
  apiKey: string,
  messages: object[],
  imageBase64: string | undefined,
  settings: AdminSettings,
): Promise<string> {
  // Rasm bo'lsa gpt-4o majburiy (vision qo'llab-quvvatlashi kerak)
  // Gemini tanlangan bo'lsa GPT fallback sifatida gpt-4o-mini ishlatiladi
  // GPT tanlangan bo'lsa admin tanlagan modelni ishlatamiz
  const model = imageBase64
    ? 'gpt-4o'
    : (settings.primaryAiModel === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: OPENAI_RESPONSE_FORMAT,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      top_p: settings.topP,
    }),
  })
  if (res.status === 429) throw new Error('RATE_LIMIT')
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(errBody.error?.message ?? `OpenAI xatosi: ${res.status}`)
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new Error('AI javob bermadi')
  return reply
}

//  Gemini call (fallback)
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  settings: AdminSettings,
  userMessage: string,
  imageBase64: string | undefined,
  imageMimeType: string | undefined,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: imageBase64 ? 'gemini-1.5-flash' : 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  })

  // History ni Gemini formatiga o'tkazish
  const geminiHistory = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }))

  const chat = model.startChat({
    history: geminiHistory,
    generationConfig: {
      temperature: settings.temperature,
      topP: settings.topP,
      maxOutputTokens: settings.maxTokens,
      responseMimeType: 'application/json',
    },
  })

  let userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
  if (imageBase64 && imageMimeType) {
    userParts = [
      { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
      { text: userMessage },
    ]
  } else {
    userParts = [{ text: userMessage }]
  }

  const result = await chat.sendMessage(userParts)
  const reply = result.response.text().trim()
  if (!reply) throw new Error('Gemini javob bermadi')
  return reply
}

// ─── Chart Image → Symbol + Timeframe Extractor ──────────────────────────────
// Rasm berilganda AI dan qaysi symbol/TF ekanini aniqlaydi (pre-call)
const VALID_SYMBOLS_LIST = [
  'BTCUSDT','BTCUSD','ETHUSDT','ETHUSD','BNBUSD',
  'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD',
  'EURGBP','EURJPY','GBPJPY','XAUUSD','XAGUSD','USOIL',
  'US30','SPX500','NAS100',
]
const VALID_TF_LIST = ['1m','5m','15m','30m','1h','4h','1d','1w']

async function extractSymbolFromImage(
  openaiKey: string | undefined,
  geminiKey: string | undefined,
  imageBase64: string,
  imageMimeType: string,
  messageHint?: string,
): Promise<{ symbol: string; timeframe: string } | null> {
  const PROMPT = `Look at this trading chart image carefully.
Your task: find the TRADING SYMBOL and TIMEFRAME shown on the chart.

How to find the timeframe: look at the chart title/header bar. TradingView shows:
- "15" or "M15" = 15-minute chart → timeframe is "15m"
- "5" or "M5" = 5-minute chart → timeframe is "5m"
- "30" or "M30" = 30-minute chart → timeframe is "30m"
- "1H" or "H1" = 1-hour chart → timeframe is "1h"
- "4H" or "H4" = 4-hour chart → timeframe is "4h"
- "D" or "1D" or "D1" = daily chart → timeframe is "1d"
- "W" or "1W" = weekly chart → timeframe is "1w"

Read the EXACT timeframe from the chart. Do NOT guess or default to 1h.

Reply with JSON ONLY, no markdown:
{"symbol":"XAUUSD","timeframe":"15m"}

Symbol must be one of: BTCUSDT, ETHUSDT, XAUUSD, EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD, EURGBP, EURJPY, GBPJPY, XAGUSD, USOIL, US30, SPX500, NAS100
Timeframe must be one of: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w`

  // Normalize timeframe strings like "M15", "H4", "15", "60" → "15m", "4h", "1m", "1h"
  const TF_NORMALIZE: Record<string, string> = {
    'm1':'1m', 'm5':'5m', 'm15':'15m', 'm30':'30m',
    'h1':'1h', 'h4':'4h', 'd1':'1d', 'w1':'1w',
    '1':'1m',  '5':'5m',  '15':'15m', '30':'30m',
    '60':'1h', '240':'4h', '1440':'1d', '10080':'1w',
    'min1':'1m','min5':'5m','min15':'15m','min30':'30m',
    'hour1':'1h','hour4':'4h','day1':'1d','week1':'1w',
    // TradingView compact labels
    'd':'1d', 'w':'1w', 'h':'1h',
  }

  // Message textdan TF izlash (foydalanuvchi "M15 grafik" deb yozgan bo'lishi mumkin)
  function tfFromText(text: string): string | null {
    if (!text) return null
    const up = text.toUpperCase()
    // Explicit TF patterns in text: M15, H4, 15M, 4H, "15 daqiqa" etc.
    for (const [key, val] of Object.entries(TF_MAP)) {
      if (up.includes(key)) return val
    }
    // Regex match: "15m", "4h", etc.
    const m = text.match(/\b(1m|5m|15m|30m|1h|4h|1d|1w)\b/i)
    if (m) return m[1].toLowerCase()
    return null
  }

  function normalizeTF(raw: string): string {
    const key = raw.toLowerCase().trim().replace(/\s+/g, '')
    if (VALID_TF_LIST.includes(key)) return key
    return TF_NORMALIZE[key] ?? '1h'
  }

  function parseExtracted(text: string): { symbol: string; timeframe: string } | null {
    try {
      const candidate = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(candidate) as { symbol?: string; timeframe?: string }
      const sym = (parsed.symbol ?? '').toUpperCase().replace('/', '').trim()
      // TF priority: 1) message text hint (user knows their own chart's TF)
      //              2) image-extracted TF (normalized)
      const textTF  = messageHint ? tfFromText(messageHint) : null
      const imageTF = normalizeTF(parsed.timeframe ?? '')
      const tf = textTF ?? imageTF
      if (!sym || !tf) return null

      // Exact match
      if (VALID_SYMBOLS_LIST.includes(sym) && VALID_TF_LIST.includes(tf)) {
        return { symbol: sym, timeframe: tf }
      }
      // Partial match — e.g. "BTC/USDT" → "BTCUSDT"
      const symMatch = VALID_SYMBOLS_LIST.find(s =>
        s.startsWith(sym.slice(0, 3)) || sym.includes(s.slice(0, 3))
      )
      if (symMatch) return { symbol: symMatch, timeframe: tf }
    } catch { /* parse failed */ }
    return null
  }

  // GPT-4o vision (cheap, fast with detail:low)
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 60,
          temperature: 0,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}`, detail: 'auto' } },
            { type: 'text', text: PROMPT },
          ]}],
        }),
      })
      if (res.ok) {
        const data = await res.json() as { choices: Array<{ message: { content: string } }> }
        const text = data.choices?.[0]?.message?.content?.trim() ?? ''
        const result = parseExtracted(text)
        if (result) return result
      }
    } catch { /* fallthrough to Gemini */ }
  }

  // Gemini fallback
  if (geminiKey) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { temperature: 0, maxOutputTokens: 80, responseMimeType: 'application/json' },
      })
      const response = await model.generateContent([
        { inlineData: { mimeType: imageMimeType as 'image/jpeg', data: imageBase64 } },
        { text: PROMPT },
      ])
      const text = response.response.text().trim()
      const result = parseExtracted(text)
      if (result) return result
    } catch { /* extraction failed */ }
  }

  return null
}

export async function POST(req: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  if (!openaiKey && !geminiKey) {
    return NextResponse.json({ error: 'AI xizmati sozlanmagan.' }, { status: 503 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "So'rov ma'lumotlari noto'g'ri" }, { status: 400 })
  }

  const { message, history = [], imageBase64, imageMimeType, userId } = parsed.data

  // ── Plan limit tekshirish (har so'rov − bitta limit) ─────────────────────
  if (userId) {
    const limitResult = await checkAndIncrementUsage(userId)
    if (limitResult.blocked) {
      return NextResponse.json(
        { error: limitResult.reason ?? 'Limit tugagan.', limitExceeded: true },
        { status: 429 }
      )
    }
  }

  //  Admin strategiyasi va sozlamalarini parallel yuklash
  const [systemPrompt, aiSettings] = await Promise.all([
    getAdminStrategy(),
    getAdminSettings(),
  ])

  //  OHLCV detection
  let detected = detectRequest(message)
  let ohlcvContext = ''
  type Candle = { timestamp: number; open: number; high: number; low: number; close: number; volume: number }
  let candleData: Candle[] | null = null
  let livePrice: number | null = null
  let snrData:       SNRResult | null = null
  let smcData:       SMCResult | null = null
  let trendData:     TrendlineResult | null = null
  let indicatorData: IndicatorResult | null = null

  // Signal so'rovi ekanligini AVVAL aniqlaymiz (fetchOHLCV dan oldin!)
  const wantsSignal = isSignalRequest(message)

  async function fetchOHLCV(sym: string, tf: string, forceRefresh = false) {
    try {
      const isCrypto = CRYPTO_SYMBOLS.has(sym)
      const provider = isCrypto ? cryptoProvider : forexProvider

      // OHLCV va live narxni parallel olamiz
      // Signal so'rovida: Firestore keshini chetlab o'tamiz — to'g'ridan provayderdan olamiz
      const ohlcvFetcher = () => provider.getOHLCV(sym, tf, 200)
      const [candles, liveTick] = await Promise.all([
        forceRefresh ? ohlcvFetcher() : withOHLCVCache(sym, tf, ohlcvFetcher),
        provider.getPrice(sym).catch(() => null),
      ])
      if (!candles || candles.length < 20) return
      candleData = candles as Candle[]

      // Live narx — kesh xatosini oldini oladi
      if (liveTick && liveTick.price > 0) {
        livePrice = liveTick.price
      }

      // Texnik indikatorlar hisoblash
      const ind = calculateIndicators(candles as Parameters<typeof calculateIndicators>[0])
      indicatorData = ind as IndicatorResult
      snrData   = calculateSNR(candles as Parameters<typeof calculateSNR>[0]) as SNRResult
      smcData   = analyzeSMC(candles as Parameters<typeof analyzeSMC>[0]) as SMCResult
      trendData = analyzeTrendlines(candles as Parameters<typeof analyzeTrendlines>[0]) as TrendlineResult

      const lastC  = candles[candles.length - 1]
      // currentClose: live narx eng aniq, bo'lmasa oxirgi sham close
      const currentClose = livePrice ?? lastC.close
      const prev20 = candles.slice(-20)
      const hi20   = Math.max(...prev20.map((c: { high: number }) => c.high))
      const lo20   = Math.min(...prev20.map((c: { low: number }) => c.low))
      const range20 = hi20 - lo20

      const atr   = ind.atr?.value   ?? 0
      const adx   = ind.adx?.adx    ?? 0
      const pdi   = ind.adx?.pdi    ?? 0
      const mdi   = ind.adx?.mdi    ?? 0
      const rsi   = ind.rsi?.value   ?? 50
      const macdH = ind.macd?.histogram ?? 0
      const macdV = ind.macd?.macd      ?? 0
      const macdS = ind.macd?.signal    ?? 0
      const bb    = ind.bollingerBands
      const ema9  = ind.ema?.find((e: { period: number }) => e.period === 9)?.value  ?? null
      const ema50 = ind.ema?.find((e: { period: number }) => e.period === 50)?.value ?? null
      const ema200= ind.ema?.find((e: { period: number }) => e.period === 200)?.value?? null

      // Trend yo'nalishi va kuchi
      const trendStr  = adx > 40 ? 'JUDA KUCHLI ⚡' : adx > 25 ? 'KUCHLI 💪' : adx > 15 ? "O'RTACHA" : "ZAIF / SIDEWAYS 😐"
      const trendDir  = pdi > mdi ? 'BULLISH ↑' : 'BEARISH ↓'
      const ema50txt  = ema50  ? (lastC.close > ema50  ? `Narx EMA50 (${ema50.toFixed(2)}) DAN YUQORI → Bullish` : `Narx EMA50 (${ema50.toFixed(2)}) DAN PAST → Bearish`) : 'N/A'
      const ema200txt = ema200 ? (lastC.close > ema200 ? `Narx EMA200 (${ema200.toFixed(2)}) DAN YUQORI → Bullish` : `Narx EMA200 (${ema200.toFixed(2)}) DAN PAST → Bearish`) : 'N/A'

      // RSI holati
      const rsiTxt = rsi > 75 ? 'JUDA YUQORI (Overbought)' : rsi > 60 ? 'YUQORI (Bullish zona)' : rsi < 25 ? 'JUDA PAST (Oversold)' : rsi < 40 ? 'PAST (Bearish zona)' : 'NEYTRAL'

      // MACD holati
      const macdTxt = macdH > 0
        ? `BULLISH (Histogram: +${macdH.toFixed(3)}, oshmoqda)`
        : `BEARISH (Histogram: ${macdH.toFixed(3)}, tushmoqda)`

      // ATR asosida haftalik kutilgan diapazon
      const candlesPerDay = tf === '1m' ? 1440 : tf === '5m' ? 288 : tf === '15m' ? 96 : tf === '30m' ? 48 : tf === '1h' ? 24 : tf === '4h' ? 6 : tf === '1d' ? 1 : 1
      const dailyAtrEstimate = atr * candlesPerDay
      const weeklyAtrEstimate = dailyAtrEstimate * 5

      // ATR asosida TP/SL maslahat
      const sl1 = (atr * 1.5).toFixed(2)
      const tp1 = (atr * 2.0).toFixed(2)
      const tp2 = (atr * 3.5).toFixed(2)
      const tp3 = (atr * 5.5).toFixed(2)

      ohlcvContext = `

════════════════════════════════════════
📊 BOZOR MA'LUMOTLARI: ${sym} [${tf.toUpperCase()}]
════════════════════════════════════════

📍 JORIY NARX (LIVE): ${currentClose}${livePrice ? ' ✅ (real-vaqt)' : ' ⚠️ (oxirgi sham)'}
🕯️ OXIRGI TUGATILGAN SHAM: Ochilish=${lastC.open} | Yuqori=${lastC.high} | Past=${lastC.low} | Yopilish=${lastC.close}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 TREND VA KUCHi (ADX):
  • ADX: ${adx.toFixed(1)} → Trend kuchi: ${trendStr}
  • Yo'nalish: +DI=${pdi.toFixed(1)} / -DI=${mdi.toFixed(1)} → ${trendDir}
  • ${ema50txt}
  • ${ema200txt}

⚡ MOMENTUM:
  • RSI(14): ${rsi.toFixed(1)} → ${rsiTxt}
  • MACD: ${macdTxt}
  • MACD qiymati: ${macdV.toFixed(4)} | Signal: ${macdS.toFixed(4)}
  • EMA9: ${ema9?.toFixed(2) ?? 'N/A'} (tezlik ko'rsatgichi)

📏 VOLATILLIK (ATR):
  • ATR(14): ${atr.toFixed(2)} → Har ${tf} sham uchun kutilgan harakat: ~${atr.toFixed(2)} nuqta
  • 1 KUNLIK kutilgan harakat: ~${dailyAtrEstimate.toFixed(0)} nuqta
  • 1 HAFTALIK kutilgan harakat: ~${weeklyAtrEstimate.toFixed(0)} nuqta
  ⚠️ TP VA SL DARAJALARI SHUNGA MOS BO'LISHI SHART!

🎯 BOLLINGER BANDS (20,2):
  • Yuqori: ${bb?.upper?.toFixed(2) ?? 'N/A'} | O'rta: ${bb?.middle?.toFixed(2) ?? 'N/A'} | Quyi: ${bb?.lower?.toFixed(2) ?? 'N/A'}
  • Bandwidth: ${bb?.bandwidth?.toFixed(1) ?? 'N/A'}%${bb?.upper && lastC.close > bb.upper ? ' → Yuqori banddan chiqdi! (Overbought)' : bb?.lower && lastC.close < bb.lower ? ' → Quyi banddan chiqdi! (Oversold)' : ''}

📊 ASOSIY DARAJALAR (oxirgi 20 sham):
  • 20-sham Yuqori: ${hi20.toFixed(2)} (Resistance)
  • 20-sham Quyi:  ${lo20.toFixed(2)} (Support)
  • 20-sham Diapazon: ${range20.toFixed(2)} nuqta

� ATR REFERANS (ma'lumot uchun):
  • SL referans: ~${sl1} nuqta (ATR×1.5)
  • TP1 referans: ~${tp1} nuqta (ATR×2.0)
  • TP2 referans: ~${tp2} nuqta (ATR×3.5)
  • TP3 referans: ~${tp3} nuqta (ATR×5.5)
  • Kunlik kutilgan harakat: ~${dailyAtrEstimate.toFixed(0)} nuqta
  • Haftalik kutilgan harakat: ~${weeklyAtrEstimate.toFixed(0)} nuqta
════════════════════════════════════════`
    } catch { /* OHLCV xatosi */ }
  }

  // Haftalik yoki ko'p kunlik so'rov bo'lsa D1 ham yuklanadi (multi-timeframe)
  let d1Context = ''
  async function fetchD1Context(sym: string) {
    try {
      const isWeeklyQuery = /hafta|weekly|week|kunlar|days|keyingi\s+\d+/i.test(message)
      const isLongTF = detected?.timeframe === '1d' || detected?.timeframe === '1w'
      if (!isWeeklyQuery && !isLongTF) return

      const isCrypto = CRYPTO_SYMBOLS.has(sym)
      const provider = isCrypto ? cryptoProvider : forexProvider
      const d1candles = await withOHLCVCache(sym + '_D1_mtf', '1d', () => provider.getOHLCV(sym, '1d', 60))
      if (!d1candles || d1candles.length < 14) return

      const d1ind    = calculateIndicators(d1candles as Parameters<typeof calculateIndicators>[0])
      const d1atr    = d1ind.atr?.value ?? 0
      const d1adx    = d1ind.adx?.adx  ?? 0
      const d1rsi    = d1ind.rsi?.value ?? 50
      const d1macdH  = d1ind.macd?.histogram ?? 0
      const d1pdi    = d1ind.adx?.pdi ?? 0
      const d1mdi    = d1ind.adx?.mdi ?? 0
      const d1last   = d1candles[d1candles.length - 1]
      const d1prev10 = d1candles.slice(-10)
      const d1hi10   = Math.max(...d1prev10.map((c: { high: number }) => c.high))
      const d1lo10   = Math.min(...d1prev10.map((c: { low: number }) => c.low))

      const d1TrendStr = d1adx > 40 ? 'JUDA KUCHLI ⚡' : d1adx > 25 ? 'KUCHLI 💪' : d1adx > 15 ? "O'RTACHA" : "ZAIF / SIDEWAYS"
      const d1Dir      = d1pdi > d1mdi ? 'BULLISH ↑' : 'BEARISH ↓'
      const weeklyRange = d1atr * 5

      d1Context = `

════════════════════════════════════════
🗓️ YUQORI FREYM (D1) — HAFTALIK KONTEKST: ${sym}
════════════════════════════════════════
  • D1 Joriy: O=${d1last.open} H=${d1last.high} L=${d1last.low} C=${d1last.close}
  • D1 ATR(14): ${d1atr.toFixed(2)} → Kunlik yo'l: ~${d1atr.toFixed(0)} nuqta
  • D1 ADX: ${d1adx.toFixed(1)} → ${d1TrendStr} | Yo'nalish: +DI=${d1pdi.toFixed(1)} -DI=${d1mdi.toFixed(1)} → ${d1Dir}
  • D1 RSI: ${d1rsi.toFixed(1)} | D1 MACD Histogram: ${d1macdH > 0 ? '+' : ''}${d1macdH.toFixed(4)}
  • Oxirgi 10 kun: Yuqori=${d1hi10.toFixed(2)}, Quyi=${d1lo10.toFixed(2)}, Diapazon=${(d1hi10-d1lo10).toFixed(2)}

📅 HAFTALIK KONTEKST UCHUN REFERANS:
  • 1 hafta (5 kun) kutilgan harakat: ~${weeklyRange.toFixed(0)} nuqta (D1 ATR × 5)
  • Optimistik senariy: +${(d1atr * 7).toFixed(0)} nuqta
════════════════════════════════════════`
    } catch { /* D1 xatosi */ }
  }

  if (detected) {
    // Signal so'rovida keshni chetlab o'tib fresh ma'lumot olamiz
    await fetchOHLCV(detected.symbol, detected.timeframe, wantsSignal)
    await fetchD1Context(detected.symbol)
  } else if (imageBase64) {
    // Matnda symbol yo'q, lekin rasm bor → AI dan symbol/TF ni aniqlaymiz
    console.log('[ai/chat] Rasmdan symbol aniqlanmoqda...')
    const extracted = await extractSymbolFromImage(openaiKey, geminiKey, imageBase64, imageMimeType ?? 'image/jpeg', message)
    if (extracted) {
      console.log('[ai/chat] Rasmdan topildi:', extracted.symbol, extracted.timeframe)
      detected = extracted
      await fetchOHLCV(detected.symbol, detected.timeframe, true) // har doim fresh
      await fetchD1Context(detected.symbol)
    } else {
      console.warn('[ai/chat] Rasmdan symbol aniqlanmadi')
    }
  }

  // OHLCV bor va foydalanuvchi signal so'ragan bo'lsa — signal majburiy
  const autoSignalPrefix = (detected && ohlcvContext && wantsSignal)
    ? `MAJBURIY QOIDA: Quyida ${detected.symbol} [${detected.timeframe.toUpperCase()}] bozor ma'lumotlari berilgan. Foydalanuvchi tahlil/signal so'radi. JSON ichida tahlilni VA savdo signalini qaytarishingiz SHART. Agar setup yaroqsiz bo'lsa, direction=NEUTRAL va sababini yoz.\n\n`
    : detected && ohlcvContext
      ? `MA'LUMOT: Quyida ${detected.symbol} bozor ma'lumotlari bor, lekin foydalanuvchi umumiy savol berdi. JSON ichida signal: null qaytaring. Faqat savolga javob bering.\n\n`
      : ''

  //  AI call: GPT  Gemini fallback
  const fullSystem = autoSignalPrefix + systemPrompt + buildStrategyContext(aiSettings) + ohlcvContext + d1Context

  // GPT message format
  type TextContent  = { type: 'text'; text: string }
  type ImageContent = { type: 'image_url'; image_url: { url: string; detail: 'auto' } }
  type UserContent  = string | Array<TextContent | ImageContent>

  const userContent: UserContent = imageBase64
    ? [
        { type: 'image_url' as const, image_url: { url: `data:${imageMimeType ?? 'image/jpeg'};base64,${imageBase64}`, detail: 'auto' as const } },
        { type: 'text' as const, text: message },
      ]
    : message

  const aiMessages = [
    { role: 'system', content: fullSystem },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userContent },
  ]

  let rawReply = ''
  let usedProvider = 'gpt'

  const useGeminiFirst = aiSettings.primaryAiModel.startsWith('gemini')

  if (useGeminiFirst) {
    // Admin Gemini tanlagan → Gemini birinchi, GPT fallback
    try {
      if (!geminiKey) throw new Error('Gemini key yo\'q')
      rawReply = await callGemini(geminiKey, fullSystem, history, aiSettings, message, imageBase64, imageMimeType)
      usedProvider = 'gemini'
    } catch (geminiErr) {
      console.warn('[ai/chat] Gemini xato, GPT ga o\'tilmoqda:', geminiErr instanceof Error ? geminiErr.message : geminiErr)
      if (!openaiKey) {
        return NextResponse.json({ error: 'AI xizmati vaqtincha ishlamayapti.' }, { status: 503 })
      }
      try {
        rawReply = await callGPT(openaiKey, aiMessages, imageBase64, aiSettings)
        usedProvider = 'gpt-fallback'
      } catch (gptErr) {
        console.error('[ai/chat] GPT ham xato:', gptErr)
        return NextResponse.json({ error: 'AI xizmati vaqtincha ishlamayapti. Keyinroq urinib ko\'ring.' }, { status: 503 })
      }
    }
  } else {
    // Admin GPT tanlagan → GPT birinchi, Gemini fallback
    try {
      if (openaiKey) {
        rawReply = await callGPT(openaiKey, aiMessages, imageBase64, aiSettings)
      } else {
        throw new Error('GPT key yo\'q')
      }
    } catch (gptErr) {
      // GPT ishlamadi → Gemini ga o'tamiz
      console.warn('[ai/chat] GPT xato, Gemini ga o\'tilmoqda:', gptErr instanceof Error ? gptErr.message : gptErr)
      if (!geminiKey) {
        const isRate = gptErr instanceof Error && gptErr.message === 'RATE_LIMIT'
        return NextResponse.json(
          { error: isRate ? "AI so'rovlar limiti to'ldi. Biroz kuting." : "AI xizmati vaqtincha ishlamayapti." },
          { status: 503 }
        )
      }
      try {
        rawReply = await callGemini(geminiKey, fullSystem, history, aiSettings, message, imageBase64, imageMimeType)
        usedProvider = 'gemini'
      } catch (geminiErr) {
        console.error('[ai/chat] Gemini ham xato:', geminiErr)
        return NextResponse.json({ error: 'AI xizmati vaqtincha ishlamayapti. Keyinroq urinib ko\'ring.' }, { status: 503 })
      }
    }
  }

  let aiResponse: StructuredAIResponse
  try {
    aiResponse = parseStructuredAIResponse(rawReply)
  } catch (parseErr) {
    console.error('[ai/chat] Structured response parse xato:', parseErr)
    return NextResponse.json({ error: 'AI strukturali javobni yaratolmadi. Qayta urinib ko\'ring.' }, { status: 503 })
  }

  // ── MinConfluence tekshiruvi ──────────────────────────────────────────────
  // AI signal bersa, confluenceScore ni admin belgilagan minimumdan past bo'lsa
  // signalni NEUTRAL ga o'tkazamiz — savdo qilmaslik tavsiya qilinadi
  if (
    aiResponse.signal &&
    aiResponse.signal.direction !== 'NEUTRAL' &&
    typeof aiResponse.signal.confluenceScore === 'number' &&
    aiResponse.signal.confluenceScore < aiSettings.minConfluence
  ) {
    const score = aiResponse.signal.confluenceScore
    const min   = aiSettings.minConfluence
    console.log(`[ai/chat] confluenceScore ${score}% < minConfluence ${min}% → signal NEUTRAL ga o'tkazildi`)
    aiResponse.signal.direction = 'NEUTRAL'
    aiResponse.signal.entry  = null
    aiResponse.signal.sl     = null
    aiResponse.signal.tp1    = null
    aiResponse.signal.tp2    = null
    aiResponse.signal.tp3    = null
    aiResponse.signal.rr     = null
    aiResponse.signal.reasoning = `Confluence bali (${score}%) minimal talabdan past (${min}%). Bozor holati savdo uchun etarli emas. Kuting.`
    aiResponse.reply = aiResponse.reply + `\n\n⚠️ Confluence bali ${score}% — minimal talab ${min}%. Signal berilmadi.`
  }

  const reply = aiResponse.reply

  //  Chart generation
  let chartBase64: string | null = null

  // detectedFromReply qasddan olib tashlangan:
  // AI javobida symbol bo'lishi UNKNOWN signalini keltirib chiqarardi.
  // Signal faqat foydalanuvchi xabarida aniqlangan symbol uchun yaratiladi.

  const cd = candleData as Candle[] | null
  // Live narx birinchi prioritet, bo'lmasa oxirgi sham close
  const currentPrice = livePrice ?? (cd ? cd[cd.length - 1].close : 0)
  const levels = cd && aiResponse.signal ? buildLevelsFromSignal(aiResponse.signal, currentPrice) : null
  const chartSymbol = detected?.symbol ?? 'UNKNOWN'
  const chartTf     = detected?.timeframe ?? '1h'

  // SignalData: faqat signal so'ragan bo'lsa va ma'lumot bo'lsa yaratiladi
  // Rasm orqali signal so'raganda ham (imageBase64 && detected) ishlaydi
  let signalData: ChatSignalData | null = null
  const shouldBuildSignal = wantsSignal && detected && cd
  const imageSignalFallback = imageBase64 && detected && !cd && aiResponse.signal
  if (shouldBuildSignal) {
    signalData = buildSignalData(aiResponse.signal, levels, chartSymbol, chartTf, currentPrice,
      snrData, smcData, trendData, indicatorData)
  } else if (imageSignalFallback && aiResponse.signal) {
    // Rasm uchun OHLCV yuklanmagan bo'lsa, AI signalidan to'g'ridan ishlatamiz
    const sig = aiResponse.signal
    if (sig.direction !== 'NEUTRAL' && sig.entry != null && sig.sl != null && sig.tp1 != null) {
      signalData = buildSignalData(sig, buildLevelsFromSignal(sig, sig.entry ?? 0), chartSymbol, chartTf,
        sig.entry ?? 0, null, null, null, null)
    }
  }

  // Chart uchun darajalar — signalData dan (haqiqiy SL/TP) yoki fallback
  const chartLevels: Levels = (() => {
    if (signalData && signalData.entry > 0 && signalData.sl > 0 && signalData.sl !== signalData.entry) {
      return {
        entry: signalData.entry,
        sl:    signalData.sl,
        tp1:   signalData.tp1,
        tp2:   signalData.tp2,
        tp3:   signalData.tp3,
        rr:    signalData.rr,
      }
    }
    const cp = cd ? cd[cd.length - 1].close : 0
    return { entry: cp, sl: cp, tp1: cp, tp2: cp, tp3: cp, rr: 1 }
  })()

  const analysisForChart = {
    snr: snrData ?? { zones: [], nearestSupport: null, nearestResistance: null, signal: 'NEUTRAL', score: 0 },
    smc: smcData ?? { marketStructure: [], trend: 'ranging' as const, lastBOS: null, lastCHoCH: null, fvgZones: [], liquiditySweeps: [], signal: 'NEUTRAL', score: 0 },
    trendline: trendData ?? { trendlines: [], mainTrend: 'sideways' as const, trendStrength: 0, signal: 'NEUTRAL', score: 0 },
    indicators: indicatorData,
  } as unknown as FullAnalysisResult

  if (cd) {
    try {
      const svgStr = generateChartSVG(chartSymbol, chartTf, cd, analysisForChart, chartLevels)
      chartBase64 = await svgToPngBase64(svgStr)
    } catch { /* chart xatosi */ }

    // Haqiqiy AI signal bo'lsa Firestore ga saqlash (background)
    if (levels) {
      ;(async () => {
      try {
        const direction = aiResponse.signal?.direction === 'SELL' ? 'SELL' : 'BUY'
        const { initAdmin } = await import('@/lib/firebase/admin')
        const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
        const { getStorage } = await import('firebase-admin/storage')
        initAdmin()
        const db = getFirestore()

        // Chart PNG ni Firebase Storage ga yuklash
        let chartUrl: string | null = null
        if (chartBase64) {
          try {
            const bucket = getStorage().bucket()
            const fileName = `charts/${Date.now()}_${chartSymbol}_${chartTf}.png`
            const file = bucket.file(fileName)
            const pngBuffer = Buffer.from(chartBase64, 'base64')
            await file.save(pngBuffer, {
              metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' },
            })
            // Ommaviy URL (Firebase Storage public rule bo'lishi kerak)
            await file.makePublic()
            chartUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`
          } catch (storageErr) {
            console.warn('[ai/chat] Storage yuklash xatosi:', storageErr)
          }
        }

        await db.collection('aiSignals').add({
          symbol:           chartSymbol,
          timeframe:        chartTf,
          direction,
          entry:            levels.entry,
          sl:               levels.sl,
          tp1:              levels.tp1,
          tp2:              levels.tp2,
          tp3:              levels.tp3,
          rr:               levels.rr,
          status:           'open',
          // Signal turi: ACTIVE (darhol) | PENDING (trigger kutiladi)
          signalStatus:     (signalData?.status === 'PENDING') ? 'PENDING' : 'ACTIVE',
          triggerZone:      signalData?.triggerZone ?? null,
          triggerCondition: signalData?.triggerCondition ?? null,
          validUntil:       (signalData?.validHours ?? 0) > 0
            ? new Date(Date.now() + (signalData!.validHours) * 3_600_000).toISOString()
            : null,
          triggeredAt:      null,
          closedAt:         null,
          closedPrice:      null,
          pips:             null,
          chartUrl,
          aiReply:          reply,
          createdAt:        FieldValue.serverTimestamp(),
        })
      } catch { /* signal saqlash ixtiyoriy — xato bo'lsa o'tkazib yuboramiz */ }
    })()
    }
  }

  return NextResponse.json({ reply, chartBase64, signalData, provider: usedProvider })
}
