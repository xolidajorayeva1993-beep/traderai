import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export async function GET(req: Request) {
  initAdmin()
  const db    = getFirestore()
  const url   = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const snap  = await db.collection('payments').orderBy('createdAt', 'desc').limit(limit).get()
  const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ payments })
}

export async function POST(req: Request) {
  try {
    initAdmin()
    const db   = getFirestore()
    const body = await req.json() as { userId: string; plan: string; amount: number; status?: string; provider?: string; email?: string }
    if (!body.userId || !body.plan || !body.amount) {
      return NextResponse.json({ error: 'userId, plan, amount majburiy' }, { status: 400 })
    }
    const ref = db.collection('payments').doc()
    await ref.set({ ...body, status: body.status ?? 'success', createdAt: new Date().toISOString() })
    return NextResponse.json({ id: ref.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
