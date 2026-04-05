import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import { sendPushToToken, sendPushToTopic, sendPushMulticast, type PushPayload } from '@/lib/notifications/fcm'

// POST /api/notifications/send
// Body: { adminSecret?, target, topicName?, token?, payload }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      adminSecret?: string
      target: 'all' | 'topic' | 'token'
      topicName?: string
      token?: string
      payload: PushPayload
    }

    // Auth check
    const adminSecret = process.env.PUSH_ADMIN_SECRET
    if (adminSecret && body.adminSecret !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { target, payload } = body
    if (!payload?.title || !payload?.body) {
      return NextResponse.json({ error: 'payload.title va payload.body majburiy' }, { status: 400 })
    }

    if (target === 'topic') {
      const topic = body.topicName ?? 'signals'
      const msgId = await sendPushToTopic(topic, payload)
      return NextResponse.json({ ok: true, messageId: msgId })
    }

    if (target === 'token') {
      if (!body.token) return NextResponse.json({ error: 'token required' }, { status: 400 })
      const msgId = await sendPushToToken(body.token, payload)
      return NextResponse.json({ ok: true, messageId: msgId })
    }

    // target === 'all'
    initAdmin()
    const db   = getFirestore()
    const snap = await db.collection('fcmTokens').limit(1000).get()
    const tokens = snap.docs.map(d => d.data().token as string).filter(Boolean)

    if (tokens.length === 0) {
      return NextResponse.json({ ok: true, successCount: 0, failureCount: 0, message: 'Token topilmadi' })
    }

    const result = await sendPushMulticast(tokens, payload)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
