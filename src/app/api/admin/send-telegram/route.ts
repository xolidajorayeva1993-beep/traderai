// ============================================================
// /api/admin/send-telegram — Telegram ulanishini test qilish
// va qo'lda xabar yuborish
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { testTelegramConnection, sendSignalToTelegram } from '@/lib/notifications/telegram'

export async function GET(): Promise<NextResponse> {
  const result = await testTelegramConnection()
  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      type: 'test' | 'signal'
      signal?: {
        symbol: string; timeframe: string; direction: string
        confidence: number; currentPrice: number; entry: number
        tp1: number; tp2: number; tp3: number; sl: number; rr: number
        aiReason: string
      }
    }

    if (body.type === 'test') {
      const result = await testTelegramConnection()
      return NextResponse.json(result, { status: result.ok ? 200 : 503 })
    }

    if (body.type === 'signal' && body.signal) {
      const result = await sendSignalToTelegram(body.signal)
      return NextResponse.json({ sent: result.channel || result.admin, ...result })
    }

    return NextResponse.json({ error: "type 'test' yoki 'signal' bo'lishi kerak" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
