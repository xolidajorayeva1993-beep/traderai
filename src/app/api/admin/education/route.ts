// GET/POST/PATCH/DELETE /api/admin/education — Ta'lim materiallari CRUD
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    initAdmin()
    const db = getFirestore()

    let query = db.collection('education').orderBy('sortOrder', 'asc').orderBy('createdAt', 'desc') as FirebaseFirestore.Query
    if (category && category !== 'all') {
      query = db.collection('education').where('category', '==', category).orderBy('createdAt', 'desc')
    }

    const snap = await query.limit(100).get()
    const lessons = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
      updatedAt: d.data().updatedAt?.toMillis?.() ?? null,
    }))

    // Category counts
    const cats: Record<string, number> = {}
    snap.docs.forEach(d => {
      const c = (d.data().category as string) ?? 'other'
      cats[c] = (cats[c] ?? 0) + 1
    })

    return NextResponse.json({ lessons, total: lessons.length, categories: cats })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      title: string
      content: string
      category: string
      videoUrl?: string
      duration?: number
      level?: 'beginner' | 'intermediate' | 'advanced'
      sortOrder?: number
      active?: boolean
    }

    if (!body.title || !body.category) {
      return NextResponse.json({ error: 'title va category talab qilinadi' }, { status: 400 })
    }

    initAdmin()
    const db = getFirestore()

    const ref = await db.collection('education').add({
      title:     body.title,
      content:   body.content ?? '',
      category:  body.category,
      videoUrl:  body.videoUrl ?? null,
      duration:  body.duration ?? null,
      level:     body.level ?? 'beginner',
      sortOrder: body.sortOrder ?? 0,
      active:    body.active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

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

    await db.collection('education').doc(id).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    })

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
    await db.collection('education').doc(id).delete()

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
