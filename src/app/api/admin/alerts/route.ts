// ================================================================
// Admin Alerts API — real-time bildirishnomalar
// GET  /api/admin/alerts           — oxirgi alertlar
// POST /api/admin/alerts           — yangi alert yaratish
// PATCH /api/admin/alerts?id=xxx   — o'qilgan deb belgilash
// ================================================================
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    initAdmin()
    const db = getFirestore()
    const snap = await db.collection('adminAlerts')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    const alerts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    const unread = alerts.filter((a: Record<string, unknown>) => !a.read).length
    return NextResponse.json({ alerts, unread })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const body = await req.json()
    const { type, title, message, level = 'info' } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'title va message majburiy' }, { status: 400 })
    }

    const doc = await db.collection('adminAlerts').add({
      type: type ?? 'manual',
      title,
      message,
      level, // info | warn | error | success
      read: false,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({ id: doc.id, success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const id = req.nextUrl.searchParams.get('id')

    if (id) {
      await db.collection('adminAlerts').doc(id).update({ read: true })
    } else {
      // Mark all as read
      const snap = await db.collection('adminAlerts').where('read', '==', false).get()
      const batch = db.batch()
      for (const doc of snap.docs) batch.update(doc.ref, { read: true })
      await batch.commit()
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
