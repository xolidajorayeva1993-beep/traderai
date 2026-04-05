// ============================================================
// AI Prompt Loader — server-side Firestore dan promptlarni oladi
// analyze API route da ishlatiladi
// ============================================================
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

interface LoadedPrompts {
  gptSystemPrompt?: string
  geminiSystemPrompt?: string
}

let _cache: { data: LoadedPrompts; ts: number } | null = null
const CACHE_TTL_MS = 60_000 // 1 daqiqa kesh

export async function loadAIStrategyPrompts(): Promise<LoadedPrompts> {
  // Keshdan qaytarish
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return _cache.data
  }

  try {
    const app = initAdmin()
    const db  = getFirestore(app)
    const col = db.collection('ai_prompts')

    const [gptSnap, geminiSnap] = await Promise.all([
      col.doc('gpt_strategy').get(),
      col.doc('gemini_strategy').get(),
    ])

    const gptPrompt    = gptSnap.exists    ? (gptSnap.data()?.systemPrompt    as string | undefined) : undefined
    const geminiPrompt = geminiSnap.exists ? (geminiSnap.data()?.systemPrompt as string | undefined) : undefined

    const data: LoadedPrompts = {
      gptSystemPrompt:    gptPrompt?.trim()    || undefined,
      geminiSystemPrompt: geminiPrompt?.trim() || undefined,
    }

    _cache = { data, ts: Date.now() }
    return data
  } catch {
    // Firestore yo'q bo'lsa yoki xato — default prompt ishlatiladi
    return {}
  }
}
