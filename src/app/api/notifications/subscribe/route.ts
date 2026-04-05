import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { sendPushToToken, sendPushToTopic, sendPushMulticast, type PushPayload } from '@/lib/notifications/fcm'

// POST /api/notifications/subscribe  { token, uid?, topics? }
// POST /api/notifications/send       { adminSecret, target, payload, type }
// DELETE /api/notifications/subscribe?token=xxx

export async function POST(req: NextRequest) {
  try {
    const url    = new URL(req.url)
    const action = url.pathname.split('/').pop() // 'subscribe' | 'send'

    if (action === 'subscribe') {
      return handleSubscribe(req)
    }
    if (action === 'send') {
      return handleSend(req)
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    initAdmin()
    const db = getFirestore()
    const snap = await db.collection('fcmTokens').where('token', '==', token).limit(1).get()
    if (!snap.empty) await snap.docs[0].ref.delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── Subscribe ─────────────────────────────────────────────────
async function handleSubscribe(req: NextRequest) {
  const body = await req.json() as { token?: string; uid?: string; topics?: string[] }
  const { token, uid, topics } = body
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  initAdmin()
  const db = getFirestore()

  // Upsert FCM token in Firestore
  await db.collection('fcmTokens').doc(token).set({
    token,
    uid:       uid       ?? null,
    topics:    topics    ?? ['signals'],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  return NextResponse.json({ ok: true, subscribed: topics ?? ['signals'] })
}

// ── Send (admin-only) ─────────────────────────────────────────
async function handleSend(req: NextRequest) {
  const body = await req.json() as {
    adminSecret?: string
    target: 'all' | 'topic' | 'token'
    topicName?: string
    token?: string
    uid?: string
    payload: PushPayload
    type?: 'signal' | 'announcement' | 'custom'
  }

  // Minimal auth guard — checks env var secret
  const adminSecret = process.env.PUSH_ADMIN_SECRET
  if (adminSecret && body.adminSecret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { target, payload } = body

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

  // target === 'all' — fetch all tokens from Firestore
  initAdmin()
  const db   = getFirestore()
  const snap = await db.collection('fcmTokens').limit(1000).get()
  const tokens = snap.docs.map(d => d.data().token as string).filter(Boolean)

  const result = await sendPushMulticast(tokens, payload)
  return NextResponse.json({ ok: true, ...result })
}
