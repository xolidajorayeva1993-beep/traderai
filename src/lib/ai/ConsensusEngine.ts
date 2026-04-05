// ============================================================
// Consensus Engine — GPT + Gemini natijalarini birlashtiradi
// ============================================================

import type { GPTVerdict, GeminiVerdict, ConsensusResult, ConsensusType } from './types'

function avg(a: number, b: number): number {
  return Math.round((a + b) / 2)
}

function pickVerdict(gpt: GPTVerdict | null, gemini: GeminiVerdict | null, field: keyof GPTVerdict & keyof GeminiVerdict): number {
  if (gpt && gemini) return (Number(gpt[field]) + Number(gemini[field])) / 2
  if (gpt) return Number(gpt[field])
  if (gemini) return Number(gemini[field])
  return 0
}

export function buildConsensus(
  gpt: GPTVerdict | null,
  gemini: GeminiVerdict | null,
  currentPrice: number,
): ConsensusResult {
  // If only one AI succeeded, use it as-is with reduced confidence
  if (!gpt && !gemini) {
    return {
      consensus: 'NEUTRAL',
      confidence: 0,
      direction: 'NEUTRAL',
      entry: currentPrice,
      stopLoss: currentPrice,
      takeProfit1: currentPrice,
      takeProfit2: currentPrice,
      takeProfit3: currentPrice,
      riskReward: '1:0',
      combinedReasoning: 'AI tahlil muvaffaqiyatsiz yakunlandi.',
      watchout: 'Ikkala AI ham javob bermadi — signal yuborilmadi.',
      gptDirection: 'NEUTRAL',
      geminiDirection: 'NEUTRAL',
      conflict: false,
    }
  }

  const gptDir = gpt?.direction ?? 'NEUTRAL'
  const geminiDir = gemini?.direction ?? 'NEUTRAL'
  const gptConf = gpt?.confidence ?? 0
  const geminiConf = gemini?.confidence ?? 0

  let consensus: ConsensusType
  let direction: 'BUY' | 'SELL' | 'NEUTRAL'
  let confidence: number
  let conflict = false

  if (gptDir === geminiDir) {
    // Perfect agreement
    direction = gptDir
    confidence = avg(gptConf, geminiConf) + 5  // bonus for agreement
    confidence = Math.min(confidence, 99)
    if (direction === 'BUY')     consensus = confidence >= 70 ? 'STRONG_BUY'  : 'WEAK_BUY'
    else if (direction === 'SELL') consensus = confidence >= 70 ? 'STRONG_SELL' : 'WEAK_SELL'
    else                          consensus = 'NEUTRAL'
  } else if (gptDir === 'NEUTRAL') {
    // GPT neutral, Gemini has direction
    direction = geminiDir
    confidence = Math.round(geminiConf * 0.8) // penalize single AI
    consensus = direction === 'BUY' ? 'WEAK_BUY' : direction === 'SELL' ? 'WEAK_SELL' : 'NEUTRAL'
  } else if (geminiDir === 'NEUTRAL') {
    // Gemini neutral, GPT has direction
    direction = gptDir
    confidence = Math.round(gptConf * 0.8)
    consensus = direction === 'BUY' ? 'WEAK_BUY' : direction === 'SELL' ? 'WEAK_SELL' : 'NEUTRAL'
  } else {
    // Conflict — GTP says BUY, Gemini says SELL or vice versa
    consensus = 'CONFLICT'
    direction = 'NEUTRAL'
    confidence = 0
    conflict = true
  }

  // Price levels: average of both AIs, fallback to current price
  const entry       = pickVerdict(gpt, gemini, 'entry')       || currentPrice
  const stopLoss    = pickVerdict(gpt, gemini, 'stopLoss')    || currentPrice
  const takeProfit1 = pickVerdict(gpt, gemini, 'takeProfit1') || currentPrice
  const takeProfit2 = pickVerdict(gpt, gemini, 'takeProfit2') || currentPrice
  const takeProfit3 = pickVerdict(gpt, gemini, 'takeProfit3') || currentPrice

  // Compute RR from averaged values
  let riskReward = '1:1'
  if (stopLoss !== entry && takeProfit2 !== entry) {
    const risk   = Math.abs(entry - stopLoss)
    const reward = Math.abs(takeProfit2 - entry)
    const rr     = risk > 0 ? (reward / risk).toFixed(1) : '0'
    riskReward = `1:${rr}`
  }

  // Merge reasoning
  const parts: string[] = []
  if (gpt?.reasoning)    parts.push(`GPT: ${gpt.reasoning}`)
  if (gemini?.reasoning) parts.push(`Gemini: ${gemini.reasoning}`)
  const combinedReasoning = parts.join(' | ') || 'Tahlil mavjud emas.'

  const watchoutParts: string[] = []
  if (conflict) watchoutParts.push('AI ixtilof: GPT va Gemini qarama-qarshi natija berdi — savdo qilmang.')
  if (gpt?.watchout)    watchoutParts.push(gpt.watchout)
  if (gemini?.watchout && gemini.watchout !== gpt?.watchout) watchoutParts.push(gemini.watchout)
  const watchout = watchoutParts.join(' | ') || ''

  return {
    consensus,
    confidence,
    direction,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskReward,
    combinedReasoning,
    watchout,
    gptDirection: gptDir,
    geminiDirection: geminiDir,
    conflict,
  }
}
