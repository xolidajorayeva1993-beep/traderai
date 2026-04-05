import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export async function GET(req: Request) {
  initAdmin()
  const db    = getFirestore()
  const url   = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '50')
  const snap  = await db.collection('securityLogs')
    .orderBy('ts', 'desc')
    .limit(limit)
    .get()
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ logs })
}

export async function POST(req: Request) {
  try {
    initAdmin()
    const db   = getFirestore()
    const body = await req.json() as { action: string; uid?: string; ip?: string; meta?: Record<string, unknown> }
    if (!body.action) return NextResponse.json({ error: 'action majburiy' }, { status: 400 })
    const ref = db.collection('securityLogs').doc()
    await ref.set({ ...body, ts: new Date().toISOString() })
    return NextResponse.json({ ok: true, id: ref.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
