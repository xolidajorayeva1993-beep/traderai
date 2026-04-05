// ============================================================
// /api/admin/prompts — CRUD + versioning
// Firestore /prompts/ kolleksiyasi
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

interface PromptDoc {
  id: string
  name: string           // 'signal_analysis' | 'validation' | 'summary'
  description: string
  content: string        // Prompt matni
  model: string          // 'gpt-4o-mini' | 'gemini-2.0-flash'
  temperature: number    // 0.0 - 1.0
  maxTokens: number
  enabled: boolean
  version: number
  history: Array<{
    version: number
    content: string
    editedAt: string
    note: string
  }>
  lastUpdated: string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')

    if (name) {
      const snap = await db.collection('prompts').where('name', '==', name).limit(1).get()
      if (snap.empty) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
      const doc = snap.docs[0]
      return NextResponse.json({ id: doc.id, ...doc.data() })
    }

    const snap = await db.collection('prompts').orderBy('name').get()
    const prompts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ prompts, total: prompts.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const body = (await req.json()) as Partial<PromptDoc>
    if (!body.name || !body.content) {
      return NextResponse.json({ error: 'name va content majburiy' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const data: Omit<PromptDoc, 'id'> = {
      name:        body.name,
      description: body.description ?? '',
      content:     body.content,
      model:       body.model        ?? 'gpt-4o-mini',
      temperature: body.temperature  ?? 0.7,
      maxTokens:   body.maxTokens    ?? 1000,
      enabled:     body.enabled      ?? true,
      version:     1,
      history:     [],
      lastUpdated: now,
    }

    const ref = await db.collection('prompts').add(data)
    return NextResponse.json({ id: ref.id, ...data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const body = (await req.json()) as Partial<PromptDoc> & { id?: string; note?: string }
    if (!body.id) return NextResponse.json({ error: 'id majburiy' }, { status: 400 })

    const { id, note, ...updates } = body
    const docRef = db.collection('prompts').doc(id)
    const snap = await docRef.get()

    if (!snap.exists) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const current = snap.data() as PromptDoc
    const now = new Date().toISOString()

    // Content o'zgarsa — tarixga qo'sh
    const historyEntry = updates.content && updates.content !== current.content
      ? {
          version:  current.version,
          content:  current.content,
          editedAt: now,
          note:     note ?? 'Yangilandi',
        }
      : null

    const updateData = {
      ...updates,
      lastUpdated: now,
      version:     (current.version ?? 1) + (historyEntry ? 1 : 0),
      ...(historyEntry ? {
        history: [...(current.history ?? []), historyEntry].slice(-20), // max 20 tarix
      } : {}),
    }

    await docRef.update(updateData)

    // Chat route keshini darhol bust qilish uchun promptVersion oshiramiz
    if (historyEntry || updates.enabled !== undefined) {
      await db.collection('settings').doc('main').set(
        { promptVersion: FieldValue.increment(1) },
        { merge: true }
      )
    }

    return NextResponse.json({ id, ...updateData })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id query param majburiy' }, { status: 400 })

    await db.collection('prompts').doc(id).delete()
    return NextResponse.json({ deleted: id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
