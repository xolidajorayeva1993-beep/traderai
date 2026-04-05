// ============================================================
// GPT Analyzer — OpenAI GPT-4o-mini / GPT-4o
// Strategiya: Trendline + Chart Patterns mutaxassisi
// ============================================================

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { AnalysisContext, GPTVerdict, AIVerdictRaw } from './types'
import { buildGPTSystemPrompt, buildGPTUserPrompt } from './StrategyPromptBuilder'
import type { GPTFewShotMessage } from './trainingLoader'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY environment variable not set')
    _client = new OpenAI({ apiKey })
  }
  return _client
}

function selectModel(confidence: number): 'gpt-4o-mini' | 'gpt-4o' {
  return confidence >= 75 ? 'gpt-4o' : 'gpt-4o-mini'
}

function parseVerdict(json: string): AIVerdictRaw {
  const data = JSON.parse(json)
  const direction = (['BUY', 'SELL', 'NEUTRAL'] as const).includes(data.direction)
    ? data.direction as 'BUY' | 'SELL' | 'NEUTRAL'
    : 'NEUTRAL'

  // Malaysia SNR: scenario field (BUY LIMIT / SELL LIMIT)
  const scenarioRaw = String(data.scenario ?? '').toUpperCase()
  const scenario = scenarioRaw === 'BUY LIMIT' ? 'BUY LIMIT'
    : scenarioRaw === 'SELL LIMIT' ? 'SELL LIMIT'
    : undefined

  return {
    direction,
    scenario,
    condition: data.condition ? String(data.condition) : undefined,
    confidence: Number(data.confidence) || 50,
    entry: Number(data.entry) || 0,
    stopLoss: Number(data.stopLoss) || Number(data.stop_loss) || 0,
    takeProfit1: Number(data.takeProfit1) || Number(data.take_profit) || 0,
    takeProfit2: Number(data.takeProfit2) || 0,
    takeProfit3: Number(data.takeProfit3) || 0,
    riskReward: String(data.riskReward || data.risk_reward || '1:2'),
    reasoning: String(data.reasoning || data.reason || ''),
    keyLevels: Array.isArray(data.keyLevels) ? data.keyLevels.map(String) : [],
    watchout: String(data.watchout || ''),
  }
}

export interface GPTAnalyzeOptions {
  systemPrompt?: string        // Admin paneldan custom prompt
  chartPngBase64?: string      // chart SVG dan konvertatsiya qilingan PNG
  fewShotMessages?: GPTFewShotMessage[] // Training examples
}

export async function analyzeWithGPT(
  ctx: AnalysisContext,
  options: GPTAnalyzeOptions = {}
): Promise<GPTVerdict> {
  const client = getClient()
  const model = selectModel(ctx.confluence.score)
  const systemPrompt = buildGPTSystemPrompt(options.systemPrompt)
  const userText = buildGPTUserPrompt(ctx)

  const start = Date.now()

  // Vision: agar chart PNG bo'lsa, uni rasmli xabar sifatida yuborish
  type ContentItem =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' | 'auto' } }

  const userContent: ContentItem[] = [{ type: 'text', text: userText }]
  if (options.chartPngBase64) {
    userContent.unshift({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${options.chartPngBase64}`,
        detail: 'high',
      },
    })
  }

  // Few-shot training messages (agar mavjud bo'lsa)
  const fewShotMessages = options.fewShotMessages ?? []

  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      // Training examples (real grafiklar + to'g'ri javoblar)
      ...(fewShotMessages as unknown as ChatCompletionMessageParam[]),
      // Hozirgi so'rov
      { role: 'user', content: userContent },
    ],
    temperature: 0.25,
    max_tokens: 1000,
  })

  const latencyMs = Date.now() - start
  const rawText = response.choices[0]?.message?.content ?? '{}'
  const tokensUsed = response.usage?.total_tokens ?? 0

  return {
    ...parseVerdict(rawText),
    model,
    tokensUsed,
    latencyMs,
  }
}
