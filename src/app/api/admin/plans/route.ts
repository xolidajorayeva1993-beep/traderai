import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export async function GET() {
  initAdmin()
  const db   = getFirestore()
  const snap = await db.collection('plans').orderBy('sortOrder').get()
  const plans = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  // Price change logs
  const logSnap = await db.collection('priceChangeLogs').orderBy('changedAt', 'desc').limit(10).get()
  const priceLogs = logSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  return NextResponse.json({ plans, priceLogs })
}

export async function POST(req: Request) {
  try {
    initAdmin()
    const db   = getFirestore()
    const body = await req.json() as Record<string, unknown>
    const { name, displayName, price, currency = 'USD', period = 'monthly',
            limits = {}, trialDays = 0, sortOrder = 99, active = true } = body as {
      name?: string; displayName?: string; price?: number; currency?: string
      period?: string; limits?: Record<string, unknown>; trialDays?: number; sortOrder?: number; active?: boolean
    }
    if (!name || !displayName) {
      return NextResponse.json({ error: 'name va displayName majburiy' }, { status: 400 })
    }
    const ref  = db.collection('plans').doc()
    const plan = { name, displayName, price: price ?? 0, currency, period, limits, trialDays, sortOrder, active, createdAt: new Date().toISOString() }
    await ref.set(plan)
    return NextResponse.json({ id: ref.id, ...plan })
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
    const { id, pricePolicy, ...updates } = body as {
      id?: string
      pricePolicy?: 'grandfather' | 'immediate' | 'grace30' | 'grace90'
      [k: string]: unknown
    }
    if (!id) return NextResponse.json({ error: 'id majburiy' }, { status: 400 })

    const oldDoc = await db.collection('plans').doc(id as string).get()
    const oldData = oldDoc.data() as { price?: number; displayName?: string; name?: string } | undefined
    const newPrice = updates.price as number | undefined

    let priceChanged = false
    let affectedCount = 0

    // Price o'zgardimi?
    if (newPrice !== undefined && oldData?.price !== undefined && newPrice !== oldData.price) {
      priceChanged = true
      const now = new Date().toISOString()
      const policy = pricePolicy ?? 'grace30'

      // Grace period hisoblash
      const graceDays = policy === 'grandfather' ? 0 : policy === 'immediate' ? 0 : policy === 'grace30' ? 30 : 90
      const grandfathered = policy === 'grandfather'

      // Mavjud faol abonentlar
      const subsSnap = await db.collection('subscriptions')
        .where('planId', '==', id)
        .where('status', '==', 'active')
        .get()

      affectedCount = subsSnap.size
      const batch = db.batch()

      for (const subDoc of subsSnap.docs) {
        if (grandfathered) {
          // Avvalgi narxni saqlaydi - hech narsa o'zgarmaydi
          batch.update(subDoc.ref, {
            grandfatheredPrice: oldData.price,
            grandfathered: true,
            priceChangeNotified: false,
          })
        } else {
          // Notification + grace period
          const graceUntil = graceDays > 0
            ? new Date(Date.now() + graceDays * 86400000).toISOString()
            : null
          batch.update(subDoc.ref, {
            pendingPriceChange: newPrice,
            pendingPriceChangeAt: graceUntil ?? now,
            priceChangeNotified: false,
          })
        }

        // Alert yozamiz
        const alertRef = db.collection('adminAlerts').doc()
        batch.set(alertRef, {
          type: 'price_change',
          userId: subDoc.data().userId,
          planId: id,
          planName: oldData?.displayName ?? oldData?.name,
          oldPrice: oldData.price,
          newPrice,
          policy,
          graceDays,
          grandfathered,
          createdAt: FieldValue.serverTimestamp(),
          read: false,
        })
      }

      // Price change log
      const logRef = db.collection('priceChangeLogs').doc()
      batch.set(logRef, {
        planId: id,
        planName: oldData?.displayName ?? oldData?.name,
        oldPrice: oldData.price,
        newPrice,
        policy,
        graceDays,
        affectedSubscribers: affectedCount,
        changedAt: now,
      })

      await batch.commit()
    }

    await db.collection('plans').doc(id as string).update({ ...updates, updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true, priceChanged, affectedCount })
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
    await db.collection('plans').doc(id).delete()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
