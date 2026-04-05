// GET /api/plans — Faol tariflar ro'yxati (public)
import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    initAdmin()
    const db = getFirestore()
    const snap = await db.collection('plans').orderBy('sortOrder').get()
    const plans = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((p: Record<string, unknown>) => p.active !== false)
    return NextResponse.json({ plans })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
