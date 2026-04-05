import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// GET  /api/admin/cms/announcements
// POST /api/admin/cms/announcements  { title, body, active }
// PATCH /api/admin/cms/announcements { id, title?, body?, active? }
// DELETE /api/admin/cms/announcements?id=xxx

export async function GET() {
  try {
    initAdmin()
    const db  = getFirestore()
    const snap = await db.collection('cms_announcements')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
    const announcements = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ announcements })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title?: string; body?: string; active?: boolean }
    if (!body.title || !body.body) {
      return NextResponse.json({ error: 'title va body majburiy' }, { status: 400 })
    }
    initAdmin()
    const db  = getFirestore()
    const ref = await db.collection('cms_announcements').add({
      title:     body.title,
      body:      body.body,
      active:    body.active ?? true,
      createdAt: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id?: string; title?: string; body?: string; active?: boolean }
    if (!body.id) {
      return NextResponse.json({ error: 'id majburiy' }, { status: 400 })
    }
    initAdmin()
    const db      = getFirestore()
    const updates: Record<string, unknown> = {}
    if (body.title  !== undefined) updates.title  = body.title
    if (body.body   !== undefined) updates.body   = body.body
    if (body.active !== undefined) updates.active = body.active
    updates.updatedAt = FieldValue.serverTimestamp()
    await db.collection('cms_announcements').doc(body.id).update(updates)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id majburiy' }, { status: 400 })
    }
    initAdmin()
    const db = getFirestore()
    await db.collection('cms_announcements').doc(id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
