// ================================================================
// Training Examples Loader — Firestore dan misollarni yuklab,
// GPT va Gemini ga few-shot sifatida inject qilish uchun
// ================================================================
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export interface TrainingExample {
  id: string
  aiTarget: 'gpt' | 'gemini' | 'both'
  imageBase64: string
  signal: 'BUY' | 'SELL' | 'NEUTRAL'
  symbol: string
  timeframe: string
  patternTags: string[]
  notes: string
  entry?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  outcome?: string
}

// 3 daqiqa cache
let _cache: { gpt: TrainingExample[]; gemini: TrainingExample[]; ts: number } | null = null
const CACHE_TTL = 3 * 60 * 1000

export async function loadTrainingExamples(aiTarget: 'gpt' | 'gemini'): Promise<TrainingExample[]> {
  try {
    const now = Date.now()
    if (_cache && now - _cache.ts < CACHE_TTL) {
      return _cache[aiTarget]
    }

    initAdmin()
    const db = getFirestore()

    // GPT uchun: gpt + both
    const gptSnap = await db.collection('ai_training_examples')
      .where('aiTarget', 'in', ['gpt', 'both'])
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    // Gemini uchun: gemini + both
    const geminiSnap = await db.collection('ai_training_examples')
      .where('aiTarget', 'in', ['gemini', 'both'])
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    const mapDocs = (snap: FirebaseFirestore.QuerySnapshot): TrainingExample[] =>
      snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          aiTarget: data.aiTarget,
          imageBase64: data.imageBase64 ?? '',
          signal: data.signal,
          symbol: data.symbol,
          timeframe: data.timeframe,
          patternTags: data.patternTags ?? [],
          notes: data.notes ?? '',
          entry: data.entry ?? null,
          stopLoss: data.stopLoss ?? null,
          takeProfit: data.takeProfit ?? null,
          outcome: data.outcome ?? 'PENDING',
        }
      }).filter(e => e.imageBase64.length > 100) // rasmsizlarni o'tkazib yubor

    _cache = {
      gpt:    mapDocs(gptSnap),
      gemini: mapDocs(geminiSnap),
      ts:     now,
    }

    return _cache[aiTarget]
  } catch (e) {
    console.error('[trainingLoader]', e)
    return []
  }
}

// Cache ni tozalash (yangi misol qo'shilganda chaqiriladi)
export function clearTrainingCache() {
  _cache = null
}

// ─── GPT few-shot messages formati ──────────────────────────────────────────
// GPT ga: [image] → [user so'rov] → [assistant to'g'ri javob]
export interface GPTFewShotMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>
}

export function buildGPTFewShotMessages(examples: TrainingExample[]): GPTFewShotMessage[] {
  const messages: GPTFewShotMessage[] = []

  for (const ex of examples.slice(0, 5)) {
    // User: grafik + savol
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${ex.imageBase64}`,
            detail: 'low', // training uchun low detail yetarli — token tejash
          },
        },
        {
          type: 'text',
          text: `O'qitish misoli #${ex.id?.slice(0, 6)}:\nSymbol: ${ex.symbol}, Timeframe: ${ex.timeframe}\nPattern: ${ex.patternTags.join(', ') || 'ko\'rsatilmagan'}\nEslat: ${ex.notes || 'yo\'q'}\n\nBu grafik asosida signal ber.`,
        },
      ],
    })

    // Assistant: to'g'ri javob
    const correctAnswer = {
      direction: ex.signal,
      confidence: ex.signal === 'NEUTRAL' ? 50 : 80,
      entry: ex.entry ?? null,
      stopLoss: ex.stopLoss ?? null,
      takeProfit1: ex.takeProfit ?? null,
      reasoning: ex.notes || `${ex.signal} signal. Pattern: ${ex.patternTags.join(', ')}`,
      watchout: ex.outcome === 'LOSS' ? 'Bu signal yo\'qotish bilan yakunlandi — ehtiyot bo\'ling' : '',
    }

    messages.push({
      role: 'assistant',
      content: JSON.stringify(correctAnswer, null, 2),
    })
  }

  return messages
}

// ─── Gemini few-shot parts formati ──────────────────────────────────────────
export interface GeminiFewShotTurn {
  role: 'user' | 'model'
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
}

export function buildGeminiFewShotTurns(examples: TrainingExample[]): GeminiFewShotTurn[] {
  const turns: GeminiFewShotTurn[] = []

  for (const ex of examples.slice(0, 5)) {
    // User: grafik rasm + matn
    turns.push({
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: ex.imageBase64,
          },
        },
        {
          text: `O'qitish misoli #${ex.id?.slice(0, 6)}:\nSymbol: ${ex.symbol}, Timeframe: ${ex.timeframe}\nPattern: ${ex.patternTags.join(', ') || 'ko\'rsatilmagan'}\nEslat: ${ex.notes || 'yo\'q'}\n\nBu SMC/SNR grafikini tahlil qil.`,
        },
      ],
    })

    // Model: to'g'ri javob
    const correctAnswer = {
      direction: ex.signal,
      confidence: ex.signal === 'NEUTRAL' ? 50 : 80,
      entry: ex.entry ?? null,
      stopLoss: ex.stopLoss ?? null,
      takeProfit1: ex.takeProfit ?? null,
      reasoning: ex.notes || `${ex.signal} signal. Pattern: ${ex.patternTags.join(', ')}`,
      watchout: ex.outcome === 'LOSS' ? 'Bu signal yo\'qotish bilan yakunlandi' : '',
    }

    turns.push({
      role: 'model',
      parts: [{ text: JSON.stringify(correctAnswer, null, 2) }],
    })
  }

  return turns
}
