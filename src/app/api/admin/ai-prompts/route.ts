// ============================================================
// GET/POST /api/admin/ai-prompts
// GPT va Gemini strategiya promptlarini Firestore da saqlaydi
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import { DEFAULT_GPT_SYSTEM_PROMPT, DEFAULT_GEMINI_SYSTEM_PROMPT } from '@/lib/ai'

function getDb() {
  const app = initAdmin()
  return getFirestore(app)
}

export async function GET() {
  try {
    const db   = getDb()
    const col  = db.collection('ai_prompts')
    const [gptSnap, geminiSnap] = await Promise.all([
      col.doc('gpt_strategy').get(),
      col.doc('gemini_strategy').get(),
    ])

    return NextResponse.json({
      gpt:    gptSnap.exists    ? gptSnap.data()    : { id: 'gpt_strategy',    systemPrompt: '', updatedAt: null },
      gemini: geminiSnap.exists ? geminiSnap.data() : { id: 'gemini_strategy', systemPrompt: '', updatedAt: null },
    })
  } catch (err) {
    console.error('[ai-prompts GET]', err)
    // Firestore yo'q bo'lsa default promptlarni qaytarish
    return NextResponse.json({
      gpt:    { id: 'gpt_strategy',    systemPrompt: '', updatedAt: null },
      gemini: { id: 'gemini_strategy', systemPrompt: '', updatedAt: null },
    })
  }
}

const VALID_IDS = new Set(['gpt_strategy', 'gemini_strategy'])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id: string; systemPrompt: string }
    if (!VALID_IDS.has(body.id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    // basic sanity: max 8000 chars
    if (typeof body.systemPrompt !== 'string' || body.systemPrompt.length > 8000) {
      return NextResponse.json({ error: 'Prompt too long or invalid' }, { status: 400 })
    }

    const db  = getDb()
    const now = new Date().toISOString()
    await db.collection('ai_prompts').doc(body.id).set({
      id:           body.id,
      systemPrompt: body.systemPrompt,
      updatedAt:    now,
    }, { merge: true })

    return NextResponse.json({ ok: true, updatedAt: now })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server xatosi'
    console.error('[ai-prompts POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
