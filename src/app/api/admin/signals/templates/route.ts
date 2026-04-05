// GET /api/admin/signals/templates — signal shablonlari
// POST/PATCH/DELETE bular moderate/route.ts ga yozilgan
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    initAdmin()
    const db = getFirestore()
    const snap = await db.collection('signalTemplates').orderBy('createdAt', 'desc').get()
    const templates = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toMillis?.() ?? Date.now() }))
    return NextResponse.json({ templates })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    initAdmin()
    const db = getFirestore()
    const ref = await db.collection('signalTemplates').add({ ...body, createdAt: FieldValue.serverTimestamp(), active: true })
    return NextResponse.json({ success: true, id: ref.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id talab qilinadi' }, { status: 400 })
    initAdmin()
    const db = getFirestore()
    await db.collection('signalTemplates').doc(id).update(updates)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id talab qilinadi' }, { status: 400 })
    initAdmin()
    const db = getFirestore()
    await db.collection('signalTemplates').doc(id).delete()
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
