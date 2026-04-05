// ============================================================
// FCM Push Notification Sender
// Server-side only — uses Firebase Admin SDK
// ============================================================
import { initAdmin } from '@/lib/firebase/admin'
import { getMessaging } from 'firebase-admin/messaging'

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
  imageUrl?: string
  clickAction?: string
}

/**
 * Send push notification to a single FCM token.
 */
export async function sendPushToToken(token: string, payload: PushPayload): Promise<string> {
  initAdmin()
  const messaging = getMessaging()
  const messageId = await messaging.send({
    token,
    notification: {
      title: payload.title,
      body:  payload.body,
      imageUrl: payload.imageUrl,
    },
    data: payload.data,
    webpush: {
      fcmOptions: {
        link: payload.clickAction ?? '/',
      },
    },
  })
  return messageId
}

/**
 * Send push notification to a Firestore topic.
 */
export async function sendPushToTopic(topic: string, payload: PushPayload): Promise<string> {
  initAdmin()
  const messaging = getMessaging()
  const messageId = await messaging.send({
    topic,
    notification: {
      title: payload.title,
      body:  payload.body,
      imageUrl: payload.imageUrl,
    },
    data: payload.data,
    webpush: {
      fcmOptions: {
        link: payload.clickAction ?? '/',
      },
    },
  })
  return messageId
}

/**
 * Send push notification to multiple FCM tokens (batch).
 * Returns { successCount, failureCount, failedTokens }.
 */
export async function sendPushMulticast(
  tokens: string[],
  payload: PushPayload
): Promise<{ successCount: number; failureCount: number; failedTokens: string[] }> {
  if (tokens.length === 0) return { successCount: 0, failureCount: 0, failedTokens: [] }
  initAdmin()
  const messaging = getMessaging()

  // FCM multicast supports max 500 tokens per request
  const chunks: string[][] = []
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500))

  let successCount = 0
  let failureCount = 0
  const failedTokens: string[] = []

  for (const chunk of chunks) {
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: payload.title,
        body:  payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      webpush: {
        fcmOptions: {
          link: payload.clickAction ?? '/',
        },
      },
    })
    successCount += res.successCount
    failureCount += res.failureCount
    res.responses.forEach((r, idx) => {
      if (!r.success) failedTokens.push(chunk[idx])
    })
  }

  return { successCount, failureCount, failedTokens }
}

/**
 * Build a signal notification payload.
 */
export function buildSignalNotification(signal: {
  symbol: string
  direction: string
  confidence: number
  levels?: { entry?: number }
  id?: string
}): PushPayload {
  const dir = signal.direction.includes('BUY') ? '🟢 BUY' : signal.direction.includes('SELL') ? '🔴 SELL' : '⚪ NEYTRAL'
  return {
    title: `${dir} — ${signal.symbol}`,
    body:  `Ishonch: ${signal.confidence}% | Entry: ${signal.levels?.entry?.toFixed(2) ?? '—'}`,
    data: {
      type:     'signal',
      signalId: signal.id ?? '',
      symbol:   signal.symbol,
    },
    clickAction: signal.id ? `/signals/${signal.id}` : '/signals',
  }
}
