// GET  /api/admin/signals/moderate — tasdiqlanmagan signallar ro'yxati
// PATCH /api/admin/signals/moderate — signalni approve/reject qilish
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'pending'
    const limit  = parseInt(searchParams.get('limit') ?? '50', 10)

    initAdmin()
    const db = getFirestore()

    const snap = await db.collection('signals')
      .where('moderationStatus', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    // pending status yo'q signallarni ham ko'rsatish (eski signallar)
    let signals = snap.docs.map(d => ({
      id: d.id,
      symbol: d.data().symbol ?? '—',
      direction: d.data().direction ?? '—',
      timeframe: d.data().timeframe ?? '—',
      entryPrice: d.data().entryPrice ?? null,
      takeProfit: d.data().takeProfit ?? null,
      stopLoss: d.data().stopLoss ?? null,
      confidence: d.data().confidence ?? null,
      source: d.data().source ?? 'ai',
      userId: d.data().userId ?? null,
      createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
      moderationStatus: d.data().moderationStatus ?? 'pending',
      moderationNote: d.data().moderationNote ?? '',
      rationale: d.data().rationale ?? '',
    }))

    // Agar pending natija bo'm bo'sh bo'lsa, moderationStatus maydoni yo'q signallarni ham olish
    if (status === 'pending' && signals.length === 0) {
      const fallback = await db.collection('signals')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
      signals = fallback.docs
        .filter(d => !d.data().moderationStatus)
        .map(d => ({
          id: d.id,
          symbol: d.data().symbol ?? '—',
          direction: d.data().direction ?? '—',
          timeframe: d.data().timeframe ?? '—',
          entryPrice: d.data().entryPrice ?? null,
          takeProfit: d.data().takeProfit ?? null,
          stopLoss: d.data().stopLoss ?? null,
          confidence: d.data().confidence ?? null,
          source: d.data().source ?? 'ai',
          userId: d.data().userId ?? null,
          createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
          moderationStatus: 'pending',
          moderationNote: '',
          rationale: d.data().rationale ?? '',
        }))
    }

    return NextResponse.json({ signals, total: signals.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, action, note } = await req.json() as {
      id: string
      action: 'approve' | 'reject' | 'reset'
      note?: string
    }

    if (!id || !action) {
      return NextResponse.json({ error: 'id va action talab qilinadi' }, { status: 400 })
    }

    initAdmin()
    const db = getFirestore()
    const ref = db.collection('signals').doc(id)

    const update: Record<string, unknown> = {
      moderationStatus: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending',
      moderatedAt: FieldValue.serverTimestamp(),
    }
    if (note !== undefined) update.moderationNote = note

    await ref.update(update)

    return NextResponse.json({ success: true, id, action })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/admin/signals/moderate — signal shabloni yaratish
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      symbol: string
      direction: 'BUY' | 'SELL'
      timeframe: string
      entryPrice?: number
      takeProfit?: number
      stopLoss?: number
      confidence?: number
      rationale?: string
      templateName?: string
    }

    initAdmin()
    const db = getFirestore()

    // Signal shabloni saqlash
    if (body.templateName) {
      const { templateName, ...templateData } = body
      const ref = await db.collection('signalTemplates').add({
        ...templateData,
        name: templateName,
        createdAt: FieldValue.serverTimestamp(),
        active: true,
      })
      return NextResponse.json({ success: true, templateId: ref.id })
    }

    // Yangi moderatsiya signalin yaratish
    const ref = await db.collection('signals').add({
      ...body,
      source: 'admin',
      status: 'active',
      moderationStatus: 'approved',
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ success: true, id: ref.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
