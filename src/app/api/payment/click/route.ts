// /api/payment/click/callback — Click to'lov tizimidan callback
// Click POST so'rovini qabul qiladi va obunani faollashtiradi
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import crypto from 'crypto'

export const runtime = 'nodejs'

const PLAN_PRICES: Record<string, { usd: number; uzs: number; name: string; days: number }> = {
  pro: { usd: 29, uzs: 371_200, name: 'Pro Plan', days: 30 },
  vip: { usd: 79, uzs: 1_011_200, name: 'VIP Plan', days: 30 },
}

// Click signature verification
function verifyClickSignature(params: Record<string, string>, secretKey: string): boolean {
  const {
    click_trans_id, service_id, click_paydoc_id, merchant_trans_id,
    amount, action, sign_time, sign_string,
  } = params
  const raw = `${click_trans_id}${service_id}${secretKey}${merchant_trans_id}${amount}${action}${sign_time}`
  const expected = crypto.createHash('md5').update(raw).digest('hex')
  return sign_string === expected
}

// Prepare — Click so'ralgan to'lovni tekshiradi (ACTION=0)
export async function POST(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const secretKey = process.env.CLICK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: -9, error_note: 'Config xatosi' })
    }

    const body = await req.json() as Record<string, string>
    const { merchant_trans_id, amount, action, error: clickError } = body

    // Verify signature
    if (!verifyClickSignature(body, secretKey)) {
      return NextResponse.json({ error: -1, error_note: 'Imzo xatosi' })
    }

    // Parse transaction param: uid_planId_timestamp
    const parts  = (merchant_trans_id ?? '').split('_')
    const uid    = parts[0]
    const planId = parts[1]
    const plan   = PLAN_PRICES[planId]

    if (!uid || !plan) {
      return NextResponse.json({ error: -5, error_note: "Noto'g'ri parametrlar" })
    }

    // Verify user
    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      return NextResponse.json({ error: -5, error_note: 'Foydalanuvchi topilmadi' })
    }

    // Verify amount (allow ±1 UZS rounding)
    const expectedAmount = plan.uzs
    if (Math.abs(Number(amount) - expectedAmount) > 1) {
      return NextResponse.json({ error: -2, error_note: 'Summa mos emas' })
    }

    // ACTION 0 = prepare, ACTION 1 = complete
    if (action === '0') {
      return NextResponse.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: merchant_trans_id,
        error: 0,
        error_note: 'Success',
      })
    }

    // ACTION 1 = complete payment
    if (action === '1') {
      // Check for click error (negative = cancelled)
      if (Number(clickError) < 0) {
        return NextResponse.json({ error: -4, error_note: "To'lov bekor qilindi" })
      }

      // Activate subscription
      const now      = Date.now()
      const endDate  = now + plan.days * 86_400_000
      const trialEnd = now + 7 * 86_400_000

      const subRef = await db.collection('subscriptions').add({
        uid,
        planId,
        planName: plan.name,
        amount: plan.uzs,
        currency: 'UZS',
        amountUSD: plan.usd,
        paymentMethod: 'click',
        clickTransId: body.click_trans_id,
        status: 'active',
        startDate: now,
        endDate,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })

      await db.collection('users').doc(uid).update({
        plan: planId,
        planExpiresAt: endDate,
        trialEndsAt: trialEnd,
        updatedAt: new Date().toISOString(),
      })

      // Update paymentIntents
      const intentsSnap = await db.collection('paymentIntents')
        .where('uid', '==', uid)
        .where('planId', '==', planId)
        .where('method', '==', 'click')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
      if (!intentsSnap.empty) {
        await intentsSnap.docs[0].ref.update({ status: 'completed', subscriptionId: subRef.id })
      }

      return NextResponse.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: subRef.id,
        error: 0,
        error_note: 'Success',
      })
    }

    return NextResponse.json({ error: -8, error_note: "Noma'lum action" })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: -9, error_note: msg })
  }
}
