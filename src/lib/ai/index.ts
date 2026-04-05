// ============================================================
// AI Module — Public Exports + Main Runner
// ============================================================

export type {
  AIVerdictRaw,
  GPTVerdict,
  GeminiVerdict,
  ConsensusType,
  ConsensusResult,
  AIAnalysisResult,
  MathAnalysis,
  FathAISignal,
  FathAIResult,
  AIStrategyPrompt,
  AnalysisContext,
} from './types'

export { analyzeWithGPT }    from './GPTAnalyzer'
export { analyzeWithGemini } from './GeminiAnalyzer'
export { buildConsensus }    from './ConsensusEngine'
export { buildFathAIConsensus } from './FathAIConsensus'
export {
  buildGPTSystemPrompt,
  buildGeminiSystemPrompt,
  buildGPTUserPrompt,
  buildGeminiUserPrompt,
  DEFAULT_GPT_SYSTEM_PROMPT,
  DEFAULT_GEMINI_SYSTEM_PROMPT,
} from './StrategyPromptBuilder'
export { svgToPngBase64 } from './svgToImage'

import { analyzeWithGPT }      from './GPTAnalyzer'
import { analyzeWithGemini }   from './GeminiAnalyzer'
import { buildConsensus }      from './ConsensusEngine'
import { buildFathAIConsensus } from './FathAIConsensus'
import { svgToPngBase64 }      from './svgToImage'
import { loadTrainingExamples, buildGPTFewShotMessages, buildGeminiFewShotTurns } from './trainingLoader'
import type { AnalysisContext, AIAnalysisResult, MathAnalysis, FathAIResult } from './types'

// ─── Eski konsensus (2-manba: GPT + Gemini) ─────────────────
export async function runAIAnalysis(ctx: AnalysisContext): Promise<AIAnalysisResult> {
  const [gptResult, geminiResult] = await Promise.allSettled([
    analyzeWithGPT(ctx),
    analyzeWithGemini(ctx),
  ])

  const gpt    = gptResult.status    === 'fulfilled' ? gptResult.value    : null
  const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : null

  const errors: string[] = []
  if (gptResult.status    === 'rejected') errors.push(`GPT: ${(gptResult.reason as Error)?.message ?? 'unknown'}`)
  if (geminiResult.status === 'rejected') errors.push(`Gemini: ${(geminiResult.reason as Error)?.message ?? 'unknown'}`)

  const consensus = buildConsensus(gpt, gemini, ctx.currentPrice)

  return {
    symbol:     ctx.symbol,
    timeframe:  ctx.timeframe,
    gpt,
    gemini,
    consensus,
    analyzedAt: new Date().toISOString(),
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}

// ─── FATH AI (3-manba: GPT + Gemini + Matematik) ─────────────
export interface FathAIRunOptions {
  math: MathAnalysis           // Matematik confluence tahlili
  chartSvg?: string            // Chart SVG (vision uchun)
  gptSystemPrompt?: string     // Admin paneldan custom GPT prompt
  geminiSystemPrompt?: string  // Admin paneldan custom Gemini prompt
}

export async function runFathAIAnalysis(
  ctx: AnalysisContext,
  options: FathAIRunOptions,
): Promise<FathAIResult> {
  const { math, chartSvg, gptSystemPrompt, geminiSystemPrompt } = options

  // Chart rasmini PNG ga aylantirish + Training examples parallel yuklaymiz
  const [chartPngBase64Result, gptExamples, geminiExamples] = await Promise.all([
    chartSvg ? svgToPngBase64(chartSvg) : Promise.resolve(null),
    loadTrainingExamples('gpt'),
    loadTrainingExamples('gemini'),
  ])
  const chartPngBase64 = chartPngBase64Result

  // Few-shot messages qurish
  const gptFewShot    = buildGPTFewShotMessages(gptExamples)
  const geminiFewShot = buildGeminiFewShotTurns(geminiExamples)

  // GPT va Gemini parallel ishga tushirish
  const [gptResult, geminiResult] = await Promise.allSettled([
    analyzeWithGPT(ctx, {
      systemPrompt:    gptSystemPrompt,
      chartPngBase64:  chartPngBase64 ?? undefined,
      fewShotMessages: gptFewShot,
    }),
    analyzeWithGemini(ctx, {
      systemPrompt:   geminiSystemPrompt,
      chartPngBase64: chartPngBase64 ?? undefined,
      fewShotTurns:   geminiFewShot,
    }),
  ])

  const gpt    = gptResult.status    === 'fulfilled' ? gptResult.value    : null
  const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : null

  const errors: string[] = []
  if (gptResult.status    === 'rejected') errors.push(`GPT: ${(gptResult.reason as Error)?.message ?? 'unknown'}`)
  if (geminiResult.status === 'rejected') errors.push(`Gemini: ${(geminiResult.reason as Error)?.message ?? 'unknown'}`)

  // 3-manba FATH AI konsensus
  const fathAI = buildFathAIConsensus(gpt, gemini, math, ctx.currentPrice)

  return {
    symbol:     ctx.symbol,
    timeframe:  ctx.timeframe,
    gpt,
    gemini,
    math,
    fathAI,
    analyzedAt: new Date().toISOString(),
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}
