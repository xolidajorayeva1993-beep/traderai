// ============================================================
// Telegram Notification Service
// Signallarni Telegram kanalga yuboradi (rasm + matn)
// ============================================================

interface TelegramSignalPayload {
  symbol: string
  timeframe: string
  direction: string
  confidence: number
  currentPrice: number
  entry: number
  tp1: number
  tp2: number
  tp3: number
  sl: number
  rr: number
  aiReason: string
  chartSvg?: string // Not used for Telegram (SVG not supported)
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID ?? ''
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID ?? ''

function priceStr(v: number): string {
  return v >= 1000 ? v.toFixed(2) : v >= 10 ? v.toFixed(3) : v.toFixed(5)
}

function directionEmoji(direction: string): string {
  if (direction.includes('STRONG_BUY'))  return '🟢🟢 KUCHLI BUY'
  if (direction.includes('BUY'))         return '🟢 BUY'
  if (direction.includes('STRONG_SELL')) return '🔴🔴 KUCHLI SELL'
  if (direction.includes('SELL'))        return '🔴 SELL'
  return '⬜ NEYTRAL'
}

function buildSignalMessage(p: TelegramSignalPayload): string {
  const dir = directionEmoji(p.direction)
  const isNeutral = p.direction.includes('NEUTRAL')
  const fmt = priceStr

  const lines = [
    `📊 *FATH AI Signal*`,
    ``,
    `*${p.symbol}* · ${p.timeframe.toUpperCase()}`,
    `${dir} · Ishonch: *${p.confidence}%*`,
    ``,
    `💰 Joriy narx: \`${fmt(p.currentPrice)}\``,
  ]

  if (!isNeutral) {
    lines.push(
      ``,
      `📍 *Kirish:* \`${fmt(p.entry)}\``,
      `🎯 *TP1:* \`${fmt(p.tp1)}\`  _(+${Math.abs(p.tp1 - p.entry) > 0.01 ? ((p.tp1 - p.entry) / p.entry * 10000).toFixed(0) : '—'} pip)_`,
      `🎯 *TP2:* \`${fmt(p.tp2)}\``,
      `🎯 *TP3:* \`${fmt(p.tp3)}\``,
      `🛑 *SL:* \`${fmt(p.sl)}\``,
      `⚖️ *R:R* = 1:${p.rr.toFixed(1)}`,
    )
  }

  lines.push(
    ``,
    `🤖 _${p.aiReason.slice(0, 200)}${p.aiReason.length > 200 ? '…' : ''}_`,
    ``,
    `⚠️ Bu moliyaviy maslahat emas`,
    `📌 @trader\\_ai\\_signals`,
  )

  return lines.join('\n')
}

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN || !chatId) return false
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })
    const data = await res.json() as { ok: boolean }
    return data.ok === true
  } catch {
    return false
  }
}

/** Send signal to Telegram channel (and optionally admin chat) */
export async function sendSignalToTelegram(payload: TelegramSignalPayload): Promise<{ channel: boolean; admin: boolean }> {
  const message = buildSignalMessage(payload)
  const [channelResult, adminResult] = await Promise.allSettled([
    CHANNEL_ID ? sendTelegramMessage(CHANNEL_ID, message) : Promise.resolve(false),
    ADMIN_CHAT_ID ? sendTelegramMessage(ADMIN_CHAT_ID, message) : Promise.resolve(false),
  ])

  return {
    channel: channelResult.status === 'fulfilled' ? channelResult.value : false,
    admin:   adminResult.status   === 'fulfilled' ? adminResult.value   : false,
  }
}

/** Send a plain text notification to admin chat  */
export async function notifyAdmin(text: string): Promise<boolean> {
  return sendTelegramMessage(ADMIN_CHAT_ID, text)
}

/** Test connection — sends a test message */
export async function testTelegramConnection(): Promise<{ ok: boolean; message: string }> {
  if (!BOT_TOKEN) return { ok: false, message: 'TELEGRAM_BOT_TOKEN sozlanmagan' }
  if (!CHANNEL_ID && !ADMIN_CHAT_ID) return { ok: false, message: 'TELEGRAM_CHANNEL_ID yoki TELEGRAM_ADMIN_CHAT_ID sozlanmagan' }

  const chatId = ADMIN_CHAT_ID || CHANNEL_ID
  const ok = await sendTelegramMessage(chatId, '✅ FATH AI Telegram ulanishi ishlayapti!')
  return {
    ok,
    message: ok ? 'Telegram ulandi' : "Telegram xato — bot token yoki chat ID noto'g'ri",
  }
}
