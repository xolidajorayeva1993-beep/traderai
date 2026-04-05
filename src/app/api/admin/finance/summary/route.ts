import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export async function GET() {
  initAdmin()
  const db      = getFirestore()
  const now     = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Parallel queries
  const [allPaySnap, monthPaySnap, subsSnap] = await Promise.all([
    db.collection('payments').where('status', '==', 'success').get(),
    db.collection('payments').where('status', '==', 'success').where('createdAt', '>=', monthStart).get(),
    db.collection('users').where('role', '==', 'premium').get(),
  ])

  const totalRevenue = allPaySnap.docs.reduce((sum, d) => {
    const data = d.data() as { amount?: number }
    return sum + (data.amount ?? 0)
  }, 0)

  const monthRevenue = monthPaySnap.docs.reduce((sum, d) => {
    const data = d.data() as { amount?: number }
    return sum + (data.amount ?? 0)
  }, 0)

  const refundsSnap = await db.collection('payments').where('status', '==', 'refunded').get()

  const summary = {
    totalRevenue,
    monthRevenue,
    activeSubscribers: subsSnap.size,
    totalPayments:     allPaySnap.size,
    refunds:           refundsSnap.size,
    avgRevPerUser:     subsSnap.size > 0 ? Math.round(totalRevenue / subsSnap.size) : 0,
  }

  return NextResponse.json({ summary })
}
