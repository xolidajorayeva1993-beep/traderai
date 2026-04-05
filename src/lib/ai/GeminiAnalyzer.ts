// ============================================================
// Gemini Analyzer — Google Gemini 2.0 Flash
// Strategiya: SNR + SMC (Smart Money Concepts) mutaxassisi
// ============================================================

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import type { AnalysisContext, GeminiVerdict, AIVerdictRaw } from './types'
import { buildGeminiSystemPrompt, buildGeminiUserPrompt } from './StrategyPromptBuilder'
import type { GeminiFewShotTurn } from './trainingLoader'

let _genAI: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable not set')
    _genAI = new GoogleGenerativeAI(apiKey)
  }
  return _genAI
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]

function parseVerdict(text: string): AIVerdictRaw {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const data = JSON.parse(cleaned)
  const direction = (['BUY', 'SELL', 'NEUTRAL'] as const).includes(data.direction)
    ? data.direction as 'BUY' | 'SELL' | 'NEUTRAL'
    : 'NEUTRAL'
  return {
    direction,
    confidence: Number(data.confidence) || 50,
    entry: Number(data.entry) || 0,
    stopLoss: Number(data.stopLoss) || 0,
    takeProfit1: Number(data.takeProfit1) || 0,
    takeProfit2: Number(data.takeProfit2) || 0,
    takeProfit3: Number(data.takeProfit3) || 0,
    riskReward: String(data.riskReward || '1:1'),
    reasoning: String(data.reasoning || ''),
    keyLevels: Array.isArray(data.keyLevels) ? data.keyLevels.map(String) : [],
    watchout: String(data.watchout || ''),
  }
}

export interface GeminiAnalyzeOptions {
  systemPrompt?: string        // Admin paneldan custom prompt
  chartPngBase64?: string      // chart SVG dan konvertatsiya qilingan PNG
  fewShotTurns?: GeminiFewShotTurn[] // Training examples
}

export async function analyzeWithGemini(
  ctx: AnalysisContext,
  options: GeminiAnalyzeOptions = {}
): Promise<GeminiVerdict> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 1000,
      responseMimeType: 'application/json',
    },
  })

  const systemPrompt = buildGeminiSystemPrompt(options.systemPrompt)
  const userText = buildGeminiUserPrompt(ctx)
  const fullText = `${systemPrompt}\n\n${userText}`

  // Training few-shot turns (agar mavjud bo'lsa)
  const fewShotTurns = options.fewShotTurns ?? []

  // Vision: chart PNG ni Gemini ga inline yuborish
  type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }

  const parts: GeminiPart[] = []
  if (options.chartPngBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: options.chartPngBase64 } })
    parts.push({ text: 'Yuqoridagi chart rasmi 200 ta sham koʻrsatmoqda.\n\nVIZUAL ravishda aniqlang:\n  1. Kuchli Support/Resistance zonalari qayerda?\n  2. FVG (Fair Value Gap) — narx tez o\'tgan bo\'sh zonalar?\n  3. Order Block — oxirgi impuls oldidagi qayish sham?\n  4. BOS/CHoCH — struktura o\'zgarishi bormi?\n  5. Liquidity sweep — old high/low sinishi?\n\nVizual tahlil + quyidagi ma\'lumotlarni birlashtiring:\n\n' + fullText })
  } else {
    parts.push({ text: fullText })
  }

  const start = Date.now()

  // Few-shot uchun chat session ishlatamiz
  let rawText: string
  if (fewShotTurns.length > 0) {
    const chat = model.startChat({
      history: fewShotTurns.map(t => ({
        role: t.role,
        parts: t.parts.map(p => {
          if (p.inlineData) return { inlineData: p.inlineData }
          return { text: p.text ?? '' }
        }),
      })),
    })
    const chatResult = await chat.sendMessage(parts)
    rawText = chatResult.response.text()
  } else {
    const result = await model.generateContent(parts)
    rawText = result.response.text()
  }
  const latencyMs = Date.now() - start
  const verdict = parseVerdict(rawText)

  return {
    ...verdict,
    model: 'gemini-2.0-flash',
    latencyMs,
  }
}
