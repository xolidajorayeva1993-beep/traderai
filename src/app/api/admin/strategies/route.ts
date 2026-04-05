// ============================================================
// /api/admin/strategies — CRUD endpoint
// Firestore /strategies/ kolleksiyasini boshqaradi
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

interface StrategyDoc {
  id: string
  name: string
  description: string
  type: 'technical' | 'fundamental' | 'combined' | 'ai'
  weight: number          // 0-100
  enabled: boolean
  minConfidence: number
  symbols: string[]       // [] = all
  timeframes: string[]    // [] = all
  lastUpdated: string
  version: number
  chainOrder: number      // tartib raqami — strategy chain execution uchun
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')

    // chainOrder bo'yicha sort — strategy chain execution order
    let query = db.collection('strategies').orderBy('chainOrder', 'asc')
    if (type) {
      query = db.collection('strategies').where('type', '==', type).orderBy('chainOrder', 'asc') as typeof query
    }

    const snap = await query.get()
    const strategies: StrategyDoc[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as StrategyDoc))

    return NextResponse.json({ strategies, total: strategies.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const body = (await req.json()) as Partial<StrategyDoc>

    if (!body.name || !body.type) {
      return NextResponse.json({ error: 'name va type majburiy' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Mavjud eng katta chainOrder ni topamiz
    const lastSnap = await db.collection('strategies').orderBy('chainOrder', 'desc').limit(1).get()
    const maxOrder = lastSnap.empty ? 0 : (lastSnap.docs[0].data().chainOrder ?? 0)

    const data: Omit<StrategyDoc, 'id'> = {
      name:          body.name,
      description:   body.description ?? '',
      type:          body.type,
      weight:        body.weight        ?? 50,
      enabled:       body.enabled       ?? true,
      minConfidence: body.minConfidence ?? 60,
      symbols:       body.symbols       ?? [],
      timeframes:    body.timeframes    ?? [],
      lastUpdated:   now,
      version:       1,
      chainOrder:    body.chainOrder    ?? (maxOrder + 10),
    }

    const ref = await db.collection('strategies').add(data)
    return NextResponse.json({ id: ref.id, ...data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const body = (await req.json()) as Partial<StrategyDoc> & { id?: string }
    if (!body.id) return NextResponse.json({ error: 'id majburiy' }, { status: 400 })

    const { id, ...updates } = body
    const docRef = db.collection('strategies').doc(id)
    const snap = await docRef.get()

    if (!snap.exists) return NextResponse.json({ error: "Strategiya topilmadi: " + id }, { status: 404 })

    const current = snap.data() as StrategyDoc
    const updateData = {
      ...updates,
      lastUpdated: new Date().toISOString(),
      version: (current.version ?? 1) + 1,
      // Strategiya o'zgarganda avtomatik backtest queue ga qo'shiladi
      needsBacktest: true,
    }

    await docRef.update(updateData)

    // Backtest queue trigger — Firestore da yozamiz
    await db.collection('backtestQueue').add({
      strategyId: id,
      strategyName: (updates as Partial<StrategyDoc>).name ?? current.name,
      triggeredAt: new Date().toISOString(),
      status: 'pending',
      reason: 'strategy_updated',
    })

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

    await db.collection('strategies').doc(id).delete()
    return NextResponse.json({ deleted: id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT — bulk chainOrder yangilash: { orders: [{id, chainOrder}] }
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const body = await req.json() as { orders: { id: string; chainOrder: number }[] }
    if (!Array.isArray(body.orders) || !body.orders.length) {
      return NextResponse.json({ error: 'orders array majburiy' }, { status: 400 })
    }

    const batch = db.batch()
    const now = new Date().toISOString()
    for (const { id, chainOrder } of body.orders) {
      if (!id) continue
      batch.update(db.collection('strategies').doc(id), { chainOrder, lastUpdated: now })
    }
    await batch.commit()

    return NextResponse.json({ updated: body.orders.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
