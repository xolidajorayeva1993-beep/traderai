// ================================================================
// AI Training Examples API  grafik misollar bilan o'qitish
// GET    /api/admin/ai-training          misollar ro'yxati
// POST   /api/admin/ai-training          yangi misol saqlash
// DELETE /api/admin/ai-training?id=xxx   o'chirish
// ================================================================
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

//  GET 
export async function GET(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const url = new URL(req.url)
    const aiTarget = url.searchParams.get('ai')       // gpt | gemini | both | null=all
    const limitN   = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const noImage  = url.searchParams.get('noImage') === '1' // imageBase64 siz qaytarish

    let ref: FirebaseFirestore.Query = db.collection('ai_training_examples')
      .orderBy('createdAt', 'desc')
      .limit(limitN)

    if (aiTarget && ['gpt', 'gemini', 'both'].includes(aiTarget)) {
      ref = db.collection('ai_training_examples')
        .where('aiTarget', 'in', aiTarget === 'both' ? ['both'] : [aiTarget, 'both'])
        .orderBy('createdAt', 'desc')
        .limit(limitN)
    }

    const snap = await ref.get()
    const examples = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        aiTarget: data.aiTarget,
        signal: data.signal,
        symbol: data.symbol,
        timeframe: data.timeframe,
        patternTags: data.patternTags ?? [],
        notes: data.notes ?? '',
        entry: data.entry ?? null,
        stopLoss: data.stopLoss ?? null,
        takeProfit: data.takeProfit ?? null,
        outcome: data.outcome ?? 'PENDING',
        createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
        // Rasmni admin panel uchun qaytaramiz, AI loader uchun emas
        ...(noImage ? {} : { imageBase64: data.imageBase64 }),
      }
    })

    return NextResponse.json({ examples, total: examples.length })
  } catch (e) {
    console.error('[ai-training GET]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

//  POST 
export async function POST(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const body = await req.json()

    if (!['gpt', 'gemini', 'both'].includes(body.aiTarget))
      return NextResponse.json({ error: "aiTarget: 'gpt' | 'gemini' | 'both'" }, { status: 400 })
    if (!['BUY', 'SELL', 'NEUTRAL'].includes(body.signal))
      return NextResponse.json({ error: "signal: 'BUY' | 'SELL' | 'NEUTRAL'" }, { status: 400 })
    if (!body.imageBase64 || body.imageBase64.length < 100)
      return NextResponse.json({ error: 'Grafik rasm talab qilinadi' }, { status: 400 })
    if (body.imageBase64.length > 900_000)
      return NextResponse.json({ error: 'Rasm juda katta, iltimos kichikroq qiling' }, { status: 400 })
    if (!body.symbol?.trim() || !body.timeframe?.trim())
      return NextResponse.json({ error: 'Symbol va timeframe talab qilinadi' }, { status: 400 })

    const ref = await db.collection('ai_training_examples').add({
      aiTarget:    body.aiTarget,
      imageBase64: body.imageBase64,
      signal:      body.signal,
      symbol:      body.symbol.toUpperCase().trim(),
      timeframe:   body.timeframe.toUpperCase().trim(),
      patternTags: Array.isArray(body.patternTags) ? body.patternTags.slice(0, 10) : [],
      notes:       (body.notes ?? '').slice(0, 1000),
      entry:       body.entry    ? parseFloat(body.entry)    : null,
      stopLoss:    body.stopLoss ? parseFloat(body.stopLoss) : null,
      takeProfit:  body.takeProfit ? parseFloat(body.takeProfit) : null,
      outcome:     ['WIN', 'LOSS', 'PENDING'].includes(body.outcome) ? body.outcome : 'PENDING',
      createdAt:   FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ id: ref.id, success: true }, { status: 201 })
  } catch (e) {
    console.error('[ai-training POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

//  DELETE 
export async function DELETE(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id talab qilinadi' }, { status: 400 })

    await db.collection('ai_training_examples').doc(id).delete()
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[ai-training DELETE]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
