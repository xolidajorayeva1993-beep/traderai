// ============================================================
// PATCH /api/profile — foydalanuvchi profili sozlamalarini saqlash
// displayName, language, theme, notifSettings, telegramUsername
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const PatchSchema = z.object({
  uid:             z.string().min(1),
  displayName:     z.string().min(1).max(80).optional(),
  language:        z.enum(['uz', 'ru', 'en']).optional(),
  theme:           z.enum(['dark', 'light']).optional(),
  telegramUsername:z.string().max(50).optional(),
  notifSettings: z.object({
    signal_alerts:  z.boolean(),
    news_alerts:    z.boolean(),
    price_alerts:   z.boolean(),
    weekly_report:  z.boolean(),
  }).optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Ma'lumotlar noto'g'ri" }, { status: 400 })
    }

    const { uid, ...fields } = parsed.data
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "O'zgarish yo'q" }, { status: 400 })
    }

    const { initAdmin } = await import('@/lib/firebase/admin')
    const { getFirestore } = await import('firebase-admin/firestore')
    initAdmin()
    const db = getFirestore()

    await db.collection('users').doc(uid).update({
      ...fields,
      lastSeen: Date.now(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/profile]', err)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
}
