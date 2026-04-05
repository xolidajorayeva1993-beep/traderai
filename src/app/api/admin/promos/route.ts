import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export async function GET() {
  initAdmin()
  const db   = getFirestore()
  const snap = await db.collection('promoCodes').orderBy('createdAt', 'desc').get()
  const promos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ promos })
}

export async function POST(req: Request) {
  try {
    initAdmin()
    const db   = getFirestore()
    const body = await req.json() as Record<string, unknown>
    const { code, discountPercent = 20, maxUses = 100, expiresAt = '', planId, active = true } = body as {
      code?: string; discountPercent?: number; maxUses?: number; expiresAt?: string; planId?: string; active?: boolean
    }
    if (!code) return NextResponse.json({ error: 'code majburiy' }, { status: 400 })
    // Check uniqueness
    const exists = await db.collection('promoCodes').where('code', '==', code.trim().toUpperCase()).get()
    if (!exists.empty) return NextResponse.json({ error: 'Bu kod allaqachon mavjud' }, { status: 409 })
    const ref  = db.collection('promoCodes').doc()
    const promo = { code: code.trim().toUpperCase(), discountPercent, maxUses, usedCount: 0, expiresAt, planId: planId ?? null, active, createdAt: new Date().toISOString() }
    await ref.set(promo)
    return NextResponse.json({ id: ref.id, ...promo })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    initAdmin()
    const db   = getFirestore()
    const body = await req.json() as Record<string, unknown>
    const { id, ...updates } = body as { id?: string; [k: string]: unknown }
    if (!id) return NextResponse.json({ error: 'id majburiy' }, { status: 400 })
    await db.collection('promoCodes').doc(id as string).update({ ...updates, updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    initAdmin()
    const db  = getFirestore()
    const url = new URL(req.url)
    const id  = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id majburiy' }, { status: 400 })
    await db.collection('promoCodes').doc(id).delete()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
