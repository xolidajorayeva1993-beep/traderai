import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export async function GET() {
  initAdmin()
  const db   = getFirestore()
  const snap = await db.collection('settings').doc('main').get()
  return NextResponse.json({ settings: snap.exists ? snap.data() : {} })
}

export async function POST(req: Request) {
  try {
    initAdmin()
    const db   = getFirestore()
    const body = await req.json() as Record<string, unknown>
    await db.collection('settings').doc('main').set({ ...body, updatedAt: new Date().toISOString() }, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
