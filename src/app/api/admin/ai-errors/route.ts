// ================================================================
// AI Errors Log API — noto'g'ri signallar va AI xatolar logi
// GET /api/admin/ai-errors?limit=50
// ================================================================
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)

    // aiLogs collection da xatolik mavjud bo'lganlar
    const snap = await db.collection('aiLogs')
      .where('status', '==', 'error')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const errors = snap.docs.map(doc => {
      const d = doc.data()
      return {
        id: doc.id,
        model: d.model,
        error: d.error ?? d.errorMessage ?? 'Unknown error',
        prompt: d.systemPrompt ?? d.prompt,
        pair: d.pair,
        createdAt: d.createdAt,
      }
    })

    // Agar aiLogs dan topilmasa, signals collection dan noto'g'ri signallarni ham qayt
    const badSignalsSnap = await db.collection('signals')
      .where('aiError', '!=', null)
      .orderBy('aiError')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    const badSignals = badSignalsSnap.docs.map(doc => {
      const d = doc.data()
      return {
        id: doc.id,
        model: d.model ?? 'signal-generator',
        error: d.aiError,
        pair: d.pair ?? d.symbol,
        createdAt: d.createdAt,
      }
    })

    return NextResponse.json({
      errors: [...errors, ...badSignals].sort((a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      ).slice(0, limit),
      total: errors.length + badSignals.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
