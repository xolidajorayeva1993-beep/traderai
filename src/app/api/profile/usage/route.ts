// ============================================================
// GET /api/profile/usage?uid=...
// Foydalanuvchining joriy oylik AI chat limitini qaytaradi
// ============================================================
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_MONTHLY_LIMITS: Record<string, number> = {
  free: 10,
  pro: 100,
  vip: 500,
}

const PLAN_DISPLAY: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  vip: 'VIP',
}

/** YYYY-MM kaliti — checkAndIncrementUsage bilan bir xil */
function getMonthKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid')
  if (!uid) {
    return NextResponse.json({ error: 'uid parametri kerak' }, { status: 400 })
  }

  try {
    const { initAdmin } = await import('@/lib/firebase/admin')
    const { getFirestore } = await import('firebase-admin/firestore')
    initAdmin()
    const db = getFirestore()

    const monthKey  = getMonthKey()
    const usageDocId = `${uid}_${monthKey}`

    // Parallel: user, usage (yangi format), plans
    const [userDoc, usageDoc, plansSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('userUsage').doc(usageDocId).get(),
      db.collection('plans').limit(20).get(),
    ])

    const rawUser = userDoc.exists ? (userDoc.data() ?? {}) : {}
    const plan = ((rawUser as Record<string, unknown>).plan as string | undefined) ?? 'free'

    // Plan limitini topamiz
    const planDoc  = plansSnap.docs.find(d => (d.data() as { name?: string }).name === plan)
    const planData = planDoc?.data() as { limits?: { aiChatLimit?: number }; displayName?: string } | undefined
    const monthlyLimit: number = planData?.limits?.aiChatLimit ?? DEFAULT_MONTHLY_LIMITS[plan] ?? 10
    const planLabel = planData?.displayName ?? PLAN_DISPLAY[plan] ?? plan

    // Joriy oy qo'llanilgan hisob — yangi format: field 'count'
    const usageRaw = usageDoc.exists ? (usageDoc.data() ?? {}) : {}
    const aiChatUsed = typeof (usageRaw as Record<string, unknown>).count === 'number'
      ? ((usageRaw as Record<string, unknown>).count as number)
      : 0
    const remaining = Math.max(0, monthlyLimit - aiChatUsed)

    // Oy chegaralari (UTC)
    const now   = new Date()
    const dStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    const dEnd   = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    const daysLeft = Math.max(0, Math.ceil((dEnd - Date.now()) / (24 * 60 * 60 * 1000)))

    return NextResponse.json({
      plan,
      planLabel,
      monthlyLimit,
      aiChatUsed,
      remaining,
      periodStart: dStart,
      periodEnd:   dEnd,
      daysLeft,
      expired:     false,
    })
  } catch (err) {
    console.error('[GET /api/profile/usage]', err)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
}
