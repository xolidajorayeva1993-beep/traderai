// ============================================================
// /api/admin/signals/verify-chart
// Gemini Vision orqali AI chizgan grafik rasmini tekshiradi
// POST { signalId, imageUrl?, imageBase64?, direction, entry, sl, tp1 }
// → AI rasmni ko'rib: BUY/SELL tasdiqlaydi, entry/SL/TP ni tekshiradi
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface VerifyRequest {
  signalId?: string
  imageUrl?: string
  imageBase64?: string
  mimeType?: string
  direction: 'BUY' | 'SELL'
  entry: number
  sl: number
  tp1: number
  tp2?: number
  pair?: string
}

interface VerifyResult {
  visuallyConfirmed: boolean
  directionMatch: boolean
  chartQuality: 'good' | 'unclear' | 'no_chart'
  aiNotes: string
  suggestedDirection?: 'BUY' | 'SELL' | 'NEUTRAL'
  confidenceAdjustment: number   // -20 .. +10
  verifiedAt: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as VerifyRequest

    if (!body.imageUrl && !body.imageBase64) {
      return NextResponse.json({ error: 'imageUrl yoki imageBase64 kerak' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY sozlanmagan' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `You are a professional forex/crypto chart analyst. Analyze this trading chart image.

Signal details:
- Direction: ${body.direction}
- Pair: ${body.pair || 'unknown'}
- Entry: ${body.entry}
- Stop Loss: ${body.sl}
- TP1: ${body.tp1}${body.tp2 ? `\n- TP2: ${body.tp2}` : ''}

Questions:
1. Does the chart visually support a ${body.direction} signal? (yes/no/unclear)
2. Are there clear technical patterns visible? (list them)
3. Does the entry price look reasonable on the chart?
4. What is your overall assessment?

Respond in JSON only:
{
  "visuallyConfirmed": boolean,
  "directionMatch": boolean,
  "chartQuality": "good" | "unclear" | "no_chart",
  "suggestedDirection": "BUY" | "SELL" | "NEUTRAL",
  "patterns": ["pattern1", "pattern2"],
  "aiNotes": "brief analysis in Uzbek (2-3 sentences)",
  "confidenceAdjustment": number (-20 to +10)
}`

    let imagePart: { inlineData: { data: string; mimeType: string } } | null = null

    if (body.imageBase64) {
      imagePart = {
        inlineData: {
          data: body.imageBase64.replace(/^data:[^;]+;base64,/, ''),
          mimeType: body.mimeType || 'image/png',
        },
      }
    } else if (body.imageUrl) {
      // Download image and convert to base64
      const imgRes = await fetch(body.imageUrl, { signal: AbortSignal.timeout(10000) })
      if (!imgRes.ok) throw new Error('Rasm yuklanmadi: ' + body.imageUrl)
      const imgBuf = await imgRes.arrayBuffer()
      const base64 = Buffer.from(imgBuf).toString('base64')
      const ct = imgRes.headers.get('content-type') || 'image/png'
      imagePart = { inlineData: { data: base64, mimeType: ct } }
    }

    const response = await model.generateContent([prompt, imagePart!])
    const text = response.response.text().replace(/```json\n?|\n?```/g, '').trim()

    let parsed: Partial<VerifyResult & { patterns?: string[] }> = {}
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = {
        visuallyConfirmed: false,
        directionMatch: false,
        chartQuality: 'unclear',
        aiNotes: text.slice(0, 300),
        confidenceAdjustment: 0,
      }
    }

    const result: VerifyResult = {
      visuallyConfirmed: Boolean(parsed.visuallyConfirmed),
      directionMatch: Boolean(parsed.directionMatch),
      chartQuality: parsed.chartQuality || 'unclear',
      aiNotes: parsed.aiNotes || '',
      suggestedDirection: parsed.suggestedDirection,
      confidenceAdjustment: Number(parsed.confidenceAdjustment) || 0,
      verifiedAt: new Date().toISOString(),
    }

    // If signalId provided — save result to Firestore
    if (body.signalId) {
      initAdmin()
      const db = getFirestore()
      await db.collection('signals').doc(body.signalId).update({
        chartVerification: result,
        chartVerifiedAt: result.verifiedAt,
      })
    }

    return NextResponse.json({ result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET — signal uchun mavjud verification natijasini olish
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const { searchParams } = new URL(req.url)
    const signalId = searchParams.get('signalId')
    if (!signalId) return NextResponse.json({ error: 'signalId kerak' }, { status: 400 })

    const doc = await db.collection('signals').doc(signalId).get()
    if (!doc.exists) return NextResponse.json({ error: 'Signal topilmadi' }, { status: 404 })

    const data = doc.data()!
    return NextResponse.json({
      signalId,
      chartVerification: data.chartVerification || null,
      chartImages: data.chartImages || null,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
