// ================================================================
// System Monitoring API — API va server holati
// GET /api/admin/monitoring
// ================================================================
import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ServiceStatus {
  name: string
  status: 'ok' | 'warn' | 'error' | 'unknown'
  latency?: number
  message?: string
}

async function checkFirestore(db: FirebaseFirestore.Firestore): Promise<ServiceStatus> {
  const t0 = Date.now()
  try {
    await db.collection('_healthcheck').doc('ping').set({ ts: new Date().toISOString() })
    return { name: 'Firestore', status: 'ok', latency: Date.now() - t0 }
  } catch (e) {
    return { name: 'Firestore', status: 'error', message: String(e) }
  }
}

async function checkOpenAI(): Promise<ServiceStatus> {
  if (!process.env.OPENAI_API_KEY) return { name: 'OpenAI', status: 'warn', message: 'API key yo\'q' }
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return { name: 'OpenAI', status: 'ok', latency: Date.now() - t0 }
    return { name: 'OpenAI', status: 'warn', message: `HTTP ${res.status}` }
  } catch (e) {
    return { name: 'OpenAI', status: 'error', message: String(e) }
  }
}

async function checkGemini(): Promise<ServiceStatus> {
  if (!process.env.GEMINI_API_KEY) return { name: 'Gemini', status: 'warn', message: 'API key yo\'q' }
  const t0 = Date.now()
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return { name: 'Gemini', status: 'ok', latency: Date.now() - t0 }
    return { name: 'Gemini', status: 'warn', message: `HTTP ${res.status}` }
  } catch (e) {
    return { name: 'Gemini', status: 'error', message: String(e) }
  }
}

async function checkTelegram(): Promise<ServiceStatus> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { name: 'Telegram', status: 'warn', message: 'Token yo\'q' }
  const t0 = Date.now()
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (data.ok) return { name: 'Telegram', status: 'ok', latency: Date.now() - t0, message: `@${data.result.username}` }
    return { name: 'Telegram', status: 'warn', message: 'Bot xatosi' }
  } catch (e) {
    return { name: 'Telegram', status: 'error', message: String(e) }
  }
}

function checkEnvVars(): ServiceStatus {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'FIREBASE_PROJECT_ID',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
  ]
  const missing = required.filter(k => !process.env[k])
  if (missing.length === 0) return { name: 'Environment', status: 'ok', message: 'Barcha muhim o\'zgaruvchilar mavjud' }
  if (missing.length <= 2) return { name: 'Environment', status: 'warn', message: `Qolgan: ${missing.join(', ')}` }
  return { name: 'Environment', status: 'error', message: `${missing.length} ta o'zgaruvchi yo'q` }
}

export async function GET() {
  try {
    initAdmin()
    const db = getFirestore()

    const [firestore, openai, gemini, telegram] = await Promise.all([
      checkFirestore(db),
      checkOpenAI(),
      checkGemini(),
      checkTelegram(),
    ])
    const env = checkEnvVars()

    const services: ServiceStatus[] = [firestore, openai, gemini, telegram, env]
    const errorCount = services.filter(s => s.status === 'error').length
    const warnCount  = services.filter(s => s.status === 'warn').length
    const overallStatus = errorCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'ok'

    // Recent errors from aiLogs
    const errorsSnap = await db.collection('aiLogs')
      .where('error', '!=', null)
      .orderBy('error')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()

    const recentErrors = errorsSnap.docs.map(doc => {
      const d = doc.data()
      return { id: doc.id, error: d.error, model: d.model, createdAt: d.createdAt }
    })

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      overall: overallStatus,
      services,
      recentErrors,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
