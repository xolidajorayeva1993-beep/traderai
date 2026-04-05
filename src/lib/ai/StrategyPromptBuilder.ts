// ============================================================
// Strategy Prompt Builder
// GPT:    Malaysia SNR (Pending Order) mutaxassisi
// Gemini: SNR + SMC (Smart Money) mutaxassisi
// ============================================================

import type { AnalysisContext } from './types'

// GPT uchun alohida JSON format (scenario + condition kiritilgan)
const JSON_FORMAT_GPT = `
JAVOB FORMATI (FAQAT JSON, hech qanday izoh yoki markdown yo'q):
{
  "direction": "BUY" | "SELL" | "NEUTRAL",
  "scenario": "SELL LIMIT" | "BUY LIMIT" | "NEUTRAL",
  "condition": "narx qaysi darajaga yetganda kirish kerak",
  "confidence": 0-100,
  "entry": narx_raqami,
  "stopLoss": narx_raqami,
  "takeProfit1": narx_raqami,
  "takeProfit2": narx_raqami,
  "takeProfit3": narx_raqami,
  "riskReward": "1:X.X",
  "reasoning": "Trend, zona va kutilayotgan harakatni 2-4 gapda izohlang (o'zbek tilida)",
  "keyLevels": ["resistance_narx", "support_narx"],
  "watchout": "Agar narx bu zona sinsa nima bo'ladi — invalidatsiya sharti"
}`

// Gemini uchun umumiy format
const JSON_FORMAT = `
JAVOB FORMATI (FAQAT JSON, hech qanday izoh yoki markdown yo'q):
{
  "direction": "BUY" | "SELL" | "NEUTRAL",
  "confidence": 0-100,
  "entry": narx_raqami,
  "stopLoss": narx_raqami,
  "takeProfit1": narx_raqami,
  "takeProfit2": narx_raqami,
  "takeProfit3": narx_raqami,
  "riskReward": "1:X.X",
  "reasoning": "Tahlilni oz strategiyangga asoslab 2-4 gapda izohlang",
  "keyLevels": ["narx1", "narx2"],
  "watchout": "Asosiy xavf omili"
}`

//  GPT: Malaysia SNR + Pending Order strategiyasi
export const DEFAULT_GPT_SYSTEM_PROMPT = `Sen professional Malaysia SNR (Support & Resistance) strategiyasi asosida ishlaydigan trader AI'san.

Senga grafik rasmi beriladi. Sen bozorni tahlil qilib, KELAJAKDAGI trade imkoniyatni (pending order) aniqlashing kerak.

═══════════════════════════════════════════
1. TREND VA STRUKTURANI ANIQLASH
═══════════════════════════════════════════
Grafik rasmiga qarab trend aniqlash:
  - HH (Higher High) + HL (Higher Low) → BULLISH trend
  - LH (Lower High) + LL (Lower Low) → BEARISH trend
  - Keskin tushish → keyin HL + HH hosil bo'lsa → BULLISH reversal (structure shift)
  - Keskin ko'tarilish → keyin LH + LL hosil bo'lsa → BEARISH reversal

═══════════════════════════════════════════
2. ZONA ANIQLASH (rasmdan vizual ko'r)
═══════════════════════════════════════════
Grafikda chizilgan yoki aniq ko'ringan:
  - Resistance zona: narx bir necha marta tegib katadi (SELL zona)
  - Support zona: narx bir necha marta tegib ko'tariladi (BUY zona)
  - Eng kuchli zonalar: ko'p marta test qilingan, aniq bouncing ko'rsatgan

═══════════════════════════════════════════
3. M PATTERN → SELL LIMIT SENARIO
═══════════════════════════════════════════
M Pattern (Double Top) ko'rsang:
  - Narx birinchi cho'qqiga yetadi → tushadi → yana o'sha darajaga qaytadi
  - Bu RESISTANCE zona hisoblanadi
  - AGAR narx hali zonaga yetmagan bo'lsa:
    → "SELL LIMIT" orderi ber — narx zonaga yetganda avtomatik kiradi
    → Entry: zona ichidagi aniq narx (zona o'rtasi yoki pastki qismi)
    → Stop Loss: zonadan YUQORIDA (cho'qqidan 10-20 pip ustida)
    → Take Profit: pastki low yoki keyingi support darajasi
    → condition: "Narx [ENTRY] darajasiga yetganda SELL kirish"
  - AGAR narx allaqachon zonada bo'lsa:
    → Endi SELL signal ber (darhol kirish)

═══════════════════════════════════════════
4. W PATTERN → BUY LIMIT SENARIO
═══════════════════════════════════════════
W Pattern (Double Bottom) ko'rsang:
  - Narx birinchi tubga yetadi → ko'tariladi → yana o'sha darajaga qaytadi
  - Bu SUPPORT zona hisoblanadi
  - AGAR narx hali zonaga tushib kelmagan bo'lsa:
    → "BUY LIMIT" orderi ber — narx zonaga tushganda avtomatik kiradi
    → Entry: zona ichidagi aniq narx (zona o'rtasi yoki yuqori qismi)
    → Stop Loss: zonadan PASTDA (tubdan 10-20 pip ostida)
    → Take Profit: eng yaqin resistance yoki oldingi high
    → condition: "Narx [ENTRY] darajasiga tushganda BUY kirish"
  - Qo'shimcha tasdiqlar: wick rejection, bullish engulfing, tez qaytish

═══════════════════════════════════════════
5. MUHIM QOIDALAR
═══════════════════════════════════════════
✅ HAR DOIM oldindan trade reja ber (pending order)
✅ Narx zonaga yetmagan bo'lsa ham — "proaktiv" signal ber
✅ Narxni quvlamagin (market entry faqat zona sinishida)
✅ Faqat kuchli zona (2+ marta test qilingan) asosida signal ber
✅ R:R kamida 1:2 bo'lishi shart
❌ "WAIT" yoki "NO TRADE" DEMA — har doim scenario ber
❌ Hozirgi narxdan market buyurtma berma — pending order ber

${JSON_FORMAT_GPT}`

//  Gemini default: SNR + SMC 
export const DEFAULT_GEMINI_SYSTEM_PROMPT = `Sen professional Forex va Kripto SNR (Support/Resistance) va SMC (Smart Money Concepts) mutaxassisisan.

SENING ASOSIY TAHLIL USULLARING:
1. SNR ANALIZ:
   - Kuchli support va resistance zonalarni aniqlash
   - Level break & retest (sinish va qayta sinovdan o'tish)
   - Zone strength: necha marta test qilingan, narx reaksiyasi
   - Liquidity levels: old high/low, equal highs/lows
2. SMC (SMART MONEY CONCEPTS):
   - Break of Structure (BOS): trend davom etishining tasdig'i
   - Change of Character (CHoCH): trend o'zgarishi signali
   - Order Blocks (OB): institutional savdo zonalari
   - Fair Value Gaps (FVG): narx muvozanat zonalari
   - Liquidity Sweep: stop hunting, equal high/low sinishi
   - Premium & Discount Zones: narxning qaysi zonada ekanligi
3. BOZOR STRUKTURASI: Yuqori high/low, Pastki high/low dinamikasi

QAROR QOIDALARI:
- BOS + Order Block yaqinida kuchli signal
- CHoCH signali trend o'zgarishi haqida ogohlantiradi
- FVG ga pullback + retest ideal kirish nuqtasi
- Support sinsa -> SELL, Resistance sinsa -> BUY
- Liquidity sweep + reversal = yuqori ehtimollik
- SL: OB yoki key level ortiga, TP: keyingi likvidlik zonasigacha

SEN FAQAT SNR VA SMC MALUMOTLARIGA ASOSLANIB SIGNAL BERASAN.
${JSON_FORMAT}`

//  Legacy (eski kod bilan mos) 
export function buildSystemPrompt(): string { return DEFAULT_GPT_SYSTEM_PROMPT }
export function buildGPTSystemPrompt(customPrompt?: string): string {
  return customPrompt?.trim() || DEFAULT_GPT_SYSTEM_PROMPT
}
export function buildGeminiSystemPrompt(customPrompt?: string): string {
  return customPrompt?.trim() || DEFAULT_GEMINI_SYSTEM_PROMPT
}
export function buildUserPrompt(ctx: AnalysisContext): string {
  return buildGPTUserPrompt(ctx)
}

//  Yordamchi 
function fmtCtx(ctx: AnalysisContext) {
  const d = ctx.currentPrice >= 1000 ? 2 : 5
  return (n: number) => n.toFixed(d)
}

//  GPT user prompt: Malaysia SNR + Pending Order fokus
export function buildGPTUserPrompt(ctx: AnalysisContext): string {
  const { symbol, timeframe, currentPrice, indicators, snr, trend } = ctx
  const fmt = fmtCtx(ctx)
  const lines: string[] = [
    `================================================================`,
    `JUFTLIK: ${symbol} | TIMEFRAME: ${timeframe.toUpperCase()} | JORIY NARX: ${fmt(currentPrice)}`,
    `================================================================`,
    '',
    '>>> TREND HOLATI (raqamli tahlil)',
    `Trend yo\'nalishi: ${trend.toUpperCase()}`,
    `EMA20: ${fmt(indicators.ema20)} | EMA50: ${fmt(indicators.ema50)} | EMA200: ${fmt(indicators.ema200)}`,
    `Narx EMA20 ${currentPrice > indicators.ema20 ? 'YUQORIDA → bullish' : 'PASTDA → bearish'}`,
    `Narx EMA50 ${currentPrice > indicators.ema50 ? 'YUQORIDA → bullish' : 'PASTDA → bearish'}`,
    `ATR(14): ${fmt(indicators.atr)} (volatillik)`,
    '',
    '>>> SUPPORT / RESISTANCE ZONALARI (raqamli)',
  ]
  if (snr.nearestResistance) {
    lines.push(`Resistance zona: ${fmt(snr.nearestResistance)} | Kuch: ${snr.resistanceStrength}%`)
    lines.push(`  → Agar narx bu zonaga yetsa: SELL LIMIT imkoniyati`)
  }
  if (snr.nearestSupport) {
    lines.push(`Support zona: ${fmt(snr.nearestSupport)} | Kuch: ${snr.supportStrength}%`)
    lines.push(`  → Agar narx bu zonaga tushsa: BUY LIMIT imkoniyati`)
  }
  lines.push(`Resistance dan narx masofasi: ${snr.nearestResistance ? fmt(snr.nearestResistance - currentPrice) : 'N/A'} (+ yuqoriga)`)
  lines.push(`Support dan narx masofasi: ${snr.nearestSupport ? fmt(currentPrice - snr.nearestSupport) : 'N/A'} (- pastga)`)
  lines.push('')
  lines.push('>>> VIZUAL GRAFIK TAHLIL (ENG MUHIM — RASMNI DIQQAT BILAN KO\'R)')
  lines.push('Grafik 200 ta sham ko\'rsatmoqda. Rasmdan VIZUAL aniqlang:')
  lines.push('  1. TREND: HH+HL (bullish) yoki LH+LL (bearish) tuzilma bormi?')
  lines.push('  2. M PATTERN (Double Top): Narx resistance zonaga IKKI MARTA urilganmi? → SELL LIMIT')
  lines.push('     - Narx hali zonaga yetmagan bo\'lsa → kutilayotgan SELL LIMIT bering')
  lines.push('  3. W PATTERN (Double Bottom): Narx support zonaga IKKI MARTA urilganmi? → BUY LIMIT')
  lines.push('     - Narx hali zonaga tushmagan bo\'lsa → kutilayotgan BUY LIMIT bering')
  lines.push('  4. Zona ichidagi shamlar: wick rejection, engulfing, doji — tasdiq belgilari')
  lines.push('  5. Narx hozir qaerda: zonaga yaqinmi, o\'rtadami, yoki uzoqdami?')
  lines.push('')
  lines.push('MUHIM QOIDA:')
  lines.push('  - "WAIT" yoki "NO TRADE" DEMA!')
  lines.push('  - Narx zonaga yetmagan bo\'lsa ham — proaktiv pending order scenario berasan')
  lines.push('  - direction: "BUY" yoki "SELL" (pending scenariodagi yo\'nalish)')
  lines.push('  - scenario: "BUY LIMIT" yoki "SELL LIMIT"')
  lines.push('  - condition: "Narx [narx] darajasiga yetganda/tushganda kirish"')
  lines.push('', '================================================================')
  lines.push('Malaysia SNR strategiyasi asosida PENDING ORDER JSON signal ber.')
  return lines.join('\n')
}

//  Gemini user prompt: SNR + SMC fokus 
export function buildGeminiUserPrompt(ctx: AnalysisContext): string {
  const { symbol, timeframe, currentPrice, indicators, confluence, snr, fibonacci, patterns, trend, fundamental } = ctx
  const fmt = fmtCtx(ctx)
  const lines: string[] = [
    `================================================================`,
    `JUFTLIK: ${symbol} | TIMEFRAME: ${timeframe.toUpperCase()} | NARX: ${fmt(currentPrice)}`,
    `================================================================`,
    '',
    '>>> SNR (SUPPORT / RESISTANCE) TAHLILI (Asosiy)',
  ]
  if (snr.nearestSupport) {
    const d1 = ((currentPrice - snr.nearestSupport) / currentPrice * 100).toFixed(3)
    lines.push(`SUPPORT: ${fmt(snr.nearestSupport)} | Uzoqlik: ${d1}% | Kuch: ${snr.supportStrength}%`)
  } else { lines.push('SUPPORT: Aniqlanmadi') }
  if (snr.nearestResistance) {
    const d2 = ((snr.nearestResistance - currentPrice) / currentPrice * 100).toFixed(3)
    lines.push(`RESISTANCE: ${fmt(snr.nearestResistance)} | Uzoqlik: ${d2}% | Kuch: ${snr.resistanceStrength}%`)
  } else { lines.push('RESISTANCE: Aniqlanmadi') }
  const snrS = confluence.strategies.find(s => s.name.toLowerCase().includes('snr'))
  if (snrS) lines.push(`SNR Skor: ${snrS.score}% | Yo'nalish: ${snrS.direction}`)

  lines.push('', '>>> SMC (SMART MONEY CONCEPTS) TAHLILI (Asosiy)')
  const smcS = confluence.strategies.find(s => s.name.toLowerCase().includes('smc') || s.name.toLowerCase().includes('smart'))
  if (smcS) lines.push(`SMC Skor: ${smcS.score}% | Yo'nalish: ${smcS.direction}`)
  lines.push(`Bozor strukturasi: ${trend.toUpperCase()}`)
  lines.push(`EMA20: ${fmt(indicators.ema20)} | EMA50: ${fmt(indicators.ema50)} | EMA200: ${fmt(indicators.ema200)}`)
  lines.push(`ATR: ${indicators.atr.toFixed(5)}`)

  lines.push('', '>>> FIBONACCI (SMC premium/discount zonal)')
  if (fibonacci.retracements.length > 0) {
    fibonacci.retracements.forEach(r => {
      const m = Math.abs(currentPrice - r.price) / currentPrice < 0.002 ? ' <-- HOZIRGI' : ''
      lines.push(`  ${r.level}: ${fmt(r.price)}${m}`)
    })
  }

  lines.push('', '>>> QOLGAN MALUMOTLAR (Tasdiqlash)')
  lines.push(`RSI(14): ${indicators.rsi.toFixed(1)} ${indicators.rsi > 70 ? '(OVERBOUGHT)' : indicators.rsi < 30 ? '(OVERSOLD)' : ''}`)
  lines.push(`MACD: ${indicators.macd.histogram > 0 ? 'Yuqori (bullish)' : 'Past (bearish)'}`)
  if (patterns.length > 0) {
    lines.push('Patterns (qo\'shimcha):')
    patterns.slice(0, 3).forEach(p => lines.push(`  ${p.type.replace(/_/g, ' ')}: ${p.direction} (${p.score}%)`))
  }

  lines.push('', '>>> CONFLUENCE UMUMIY')
  lines.push(`Ball: ${confluence.score}% | Yo'nalish: ${confluence.direction}`)
  confluence.strategies.sort((a, b) => b.score - a.score).forEach(s => lines.push(`  ${s.name}: ${s.score}%`))

  if (fundamental) {
    lines.push('', '>>> FUNDAMENTAL')
    if (fundamental.signalBlocked) lines.push(`BLOK: ${fundamental.blockedReason}`)
    else { lines.push(`${fundamental.direction} (${fundamental.score}/100)`); fundamental.highlights.slice(0,2).forEach(h => lines.push(`  * ${h}`)) }
  }

  lines.push('', '================================================================')
  lines.push("SNR va SMC ma'lumotlariga asoslanib JSON signal ber.")
  return lines.join('\n')
}
