// POST /api/admin/users/bulk — ko'p userga bir vaqtda amal qilish
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    initAdmin()
    const auth = getAuth()
    const db = getFirestore()
    const body = await req.json()
    const { uids, action, value } = body

    if (!Array.isArray(uids) || uids.length === 0) {
      return NextResponse.json({ error: 'uids massiv bo\'lishi kerak' }, { status: 400 })
    }
    if (!action) {
      return NextResponse.json({ error: 'action majburiy' }, { status: 400 })
    }

    const results: { uid: string; success: boolean; error?: string }[] = []

    for (const uid of uids) {
      try {
        switch (action) {
          case 'setRole': {
            await auth.setCustomUserClaims(uid, { role: value })
            await db.collection('users').doc(uid).set({ role: value, updatedAt: new Date().toISOString() }, { merge: true })
            break
          }
          case 'setPlan': {
            await db.collection('users').doc(uid).set({ plan: value, updatedAt: new Date().toISOString() }, { merge: true })
            break
          }
          case 'disable': {
            await auth.updateUser(uid, { disabled: true })
            break
          }
          case 'enable': {
            await auth.updateUser(uid, { disabled: false })
            break
          }
          case 'delete': {
            await auth.deleteUser(uid)
            await db.collection('users').doc(uid).delete()
            break
          }
          case 'sendAlert': {
            // Firestore ga user-specific alert yozish
            await db.collection('userAlerts').add({ uid, message: value, read: false, createdAt: new Date().toISOString() })
            break
          }
          default:
            throw new Error(`Noto'g'ri amal: ${action}`)
        }
        results.push({ uid, success: true })
      } catch (e) {
        results.push({ uid, success: false, error: String(e) })
      }
    }

    const successCount = results.filter(r => r.success).length
    return NextResponse.json({ results, successCount, failCount: results.length - successCount })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
