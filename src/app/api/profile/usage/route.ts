// ============================================================
// GET /api/profile/usage?uid=...
// Foydalanuvchining joriy oylik AI chat limitini qaytaradi
// ============================================================
import { NextRequest, NextResponse } from 'next/server'

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

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

    // Foydalanuvchi va uning tarif ma'lumotlari
    const [userDoc, usageDoc] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('userUsage').doc(uid).get(),
    ])

    // Timestamp → ms konversiya
    function toMs(val: unknown): number | undefined {
      if (typeof val === 'number') return val
      if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function')
        return (val as { toMillis: () => number }).toMillis()
      if (val instanceof Date) return val.getTime()
      return undefined
    }

    const rawUser = userDoc.exists ? (userDoc.data() ?? {}) : {}
    const user = {
      plan:            (rawUser as Record<string, unknown>).plan as string | undefined,
      planActivatedAt: toMs((rawUser as Record<string, unknown>).planActivatedAt),
      planExpiresAt:   toMs((rawUser as Record<string, unknown>).planExpiresAt),
      createdAt:       toMs((rawUser as Record<string, unknown>).createdAt),
    }

    const plan = user.plan ?? 'free'
    const now  = Date.now()

    // Plan limitlarini Firestore /plans dan olish
    const plansSnap = await db.collection('plans').where('name', '==', plan).limit(1).get()
    const planData  = plansSnap.empty
      ? null
      : plansSnap.docs[0].data() as { limits?: { aiChatLimit?: number }; displayName?: string }

    const monthlyLimit: number =
      planData?.limits?.aiChatLimit ?? DEFAULT_MONTHLY_LIMITS[plan] ?? 10
    const planLabel = planData?.displayName ?? PLAN_DISPLAY[plan] ?? plan

    // Davr hisoblash
    // usageDoc da saqlangan periodStart ni birinchi olamiz
    const usageRaw = usageDoc.exists ? (usageDoc.data() ?? {}) : {}
    const storedPeriodStart = toMs((usageRaw as Record<string, unknown>).periodStart)
    const storedAiChatUsed  = (usageRaw as Record<string, unknown>).aiChatUsed

    let periodStart: number
    let periodEnd: number
    let expired = false

    if (plan === 'free') {
      // Agar saqlangan davr bo'lsa va hali tugamagan bo'lsa — uni ishlatamiz
      if (storedPeriodStart && (now - storedPeriodStart) < THIRTY_DAYS) {
        periodStart = storedPeriodStart
      } else if (storedPeriodStart) {
        // Yangi davr boshlash
        periodStart = storedPeriodStart + Math.floor((now - storedPeriodStart) / THIRTY_DAYS) * THIRTY_DAYS
      } else {
        const base = user.createdAt ?? now
        periodStart = base
      }
      periodEnd = periodStart + THIRTY_DAYS
    } else {
      // To'lovli reja: planActivatedAt dan boshlanadi
      periodStart = user.planActivatedAt
        ?? (user.planExpiresAt ? user.planExpiresAt - THIRTY_DAYS : (user.createdAt ?? now))
      periodEnd   = periodStart + THIRTY_DAYS
      if (now > periodEnd) expired = true
    }

    // Joriy davr uchun foydalanish
    const aiChatUsed = (storedPeriodStart === periodStart && typeof storedAiChatUsed === 'number') ? storedAiChatUsed : 0
    const remaining  = Math.max(0, monthlyLimit - aiChatUsed)
    const daysLeft   = Math.max(0, Math.ceil((periodEnd - now) / (24 * 60 * 60 * 1000)))

    return NextResponse.json({
      plan,
      planLabel,
      monthlyLimit,
      aiChatUsed,
      remaining,
      periodStart,
      periodEnd,
      daysLeft,
      expired,
    })
  } catch (err) {
    console.error('[GET /api/profile/usage]', err)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
}
