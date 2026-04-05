'use client'
// ============================================================
// /chat  FATH AI Chat  (fullscreen chart modal)
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Zap, AlertCircle, Image as ImageIcon, X, Trash2, ZoomIn, Share2, Copy, Check } from 'lucide-react'
import Image from 'next/image'
import SignalCard from '@/components/chat/SignalCard'
import { useAuth } from '@/stores/useAuth'
import type { ChatSignalData } from '@/lib/ai/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  imagePreview?: string
  chartBase64?: string
  signalData?: ChatSignalData
  loading?: boolean
  error?: boolean
}

const STORAGE_KEY = 'fath_ai_chat_history'
const MAX_STORED  = 60

const QUICK_ACTIONS: Array<{ label: string; cmd: string; highlight?: boolean }> = [
  { label: '📊 EURUSD tahlil',   cmd: 'EURUSD H4 tahlil qil' },
  { label: '🏅 XAUUSD signal',   cmd: 'XAUUSD H1 tahlil qil', highlight: true },
  { label: '🏆 Eng yaxshi 3 ta', cmd: "Bugun eng yaxshi 3 ta imkoniyatni ko'rsat" },
  { label: '📰 Yangiliklar',     cmd: 'Bugun qanday muhim yangiliklar bor?' },
  { label: '💰 Risk hisob',      cmd: '1000$ capital bilan XAUUSD lot size necha?' },
  { label: '📈 BTC tahlil',      cmd: 'BTCUSDT H1 tahlil qil' },
  { label: '🤔 Strategiya',      cmd: 'Scalping uchun eng yaxshi valyuta jufti?' },
]

// ─── Share helper ────────────────────────────────────────────
async function shareMsg(msg: ChatMessage): Promise<boolean> {
  const text = msg.content
  try {
    if (msg.chartBase64 && navigator.share) {
      const byteStr = atob(msg.chartBase64)
      const arr = new Uint8Array(byteStr.length)
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i)
      const file = new File([arr], 'fath-ai-chart.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text, files: [file] })
        return true
      }
    }
    if (navigator.share) { await navigator.share({ text }); return true }
    await navigator.clipboard.writeText(text); return true
  } catch { return false }
}

// ─── Message Bubble ──────────────────────────────────────────
function MessageBubble({ msg, onChartClick }: { msg: ChatMessage; onChartClick: (src: string) => void }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const ok = await shareMsg(msg)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: 10, marginBottom: 16, padding: '0 16px',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser
          ? 'linear-gradient(135deg,#5B8BFF,#9D6FFF)'
          : 'transparent',
        boxShadow: isUser ? '0 0 12px rgba(91,139,255,.3)' : '0 0 12px rgba(0,212,170,.3)',
        overflow: 'hidden',
      }}>
        {isUser ? <User size={16} color="#fff"/> : <Image src="/logo2.png" alt="FATH AI" width={34} height={34} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />}
      </div>

      <div style={{ maxWidth: '88%', minWidth: 0 }}>
        {!isUser && (
          <p style={{ fontSize: 10, fontWeight: 700, color: '#00D4AA', marginBottom: 4, letterSpacing: '.05em' }}>FATH AI</p>
        )}
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser ? 'linear-gradient(135deg,#5B8BFF,#9D6FFF)' : 'rgba(255,255,255,.06)',
          border: isUser ? 'none' : '1px solid rgba(255,255,255,.08)',
          fontSize: 14, lineHeight: 1.6, color: '#fff', backdropFilter: 'blur(10px)',
        }}>
          {/* User chart upload */}
          {msg.imagePreview && (
            <img src={msg.imagePreview} alt="upload"
              style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginBottom: 8, display: 'block' }} />
          )}

          {/* AI generated chart (only when no signalData) */}
          {msg.chartBase64 && !msg.signalData && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'rgba(0,212,170,.85)',
                letterSpacing: '.08em', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span> FATH AI CHART</span>
                <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400, fontSize: 10 }}>
                   Bosing  katta ko'rish
                </span>
              </div>
              <div
                onClick={() => onChartClick(`data:image/png;base64,${msg.chartBase64}`)}
                style={{
                  position: 'relative', cursor: 'zoom-in', display: 'inline-block',
                  borderRadius: 12, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,.15)',
                  boxShadow: '0 4px 24px rgba(0,0,0,.55)',
                  transition: 'transform .15s',
                }}
              >
                <img
                  src={`data:image/png;base64,${msg.chartBase64}`}
                  alt="AI chart"
                  style={{ height: 280, width: 'auto', maxWidth: '100%', display: 'block' }}
                />
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '4px 8px',
                  display: 'flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(6px)',
                }}>
                  <ZoomIn size={12} color="rgba(255,255,255,.8)" />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.8)' }}>Kattalashtirish</span>
                </div>
              </div>
            </div>
          )}

          {msg.loading ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#00D4AA',
                  animation: `bounce 1.2s ease-in-out ${i*.2}s infinite`,
                }} />
              ))}
            </div>
          ) : msg.error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF4D6A' }}>
              <AlertCircle size={14} />
              <span>{msg.content}</span>
            </div>
          ) : msg.signalData ? (
            /* Professional signal card */
            <SignalCard
              signal={msg.signalData}
              chartBase64={msg.chartBase64}
              onChartZoom={src => onChartClick(src)}
            />
          ) : (
            <pre style={{ fontFamily: 'inherit', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.content}
            </pre>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', margin: 0 }}>
            {new Date(msg.timestamp).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {!isUser && !msg.loading && (
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <button
                onClick={handleShare}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                  background: copied
                    ? 'linear-gradient(135deg,rgba(0,212,170,.3),rgba(0,212,170,.15))'
                    : 'linear-gradient(135deg,rgba(91,139,255,.18),rgba(157,111,255,.12))',
                  color: copied ? '#00D4AA' : 'rgba(255,255,255,.75)',
                  fontSize: 12, fontWeight: 700, transition: 'all .2s',
                  border: `1px solid ${copied ? 'rgba(0,212,170,.35)' : 'rgba(91,139,255,.3)'}`,
                  boxShadow: copied ? '0 0 12px rgba(0,212,170,.2)' : '0 2px 8px rgba(0,0,0,.3)',
                }}
              >
                {copied ? <Check size={13}/> : <Share2 size={13}/>}
                {copied ? 'Ulashildi!' : 'Ulashish'}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                title="Nusxalash"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 13px', borderRadius: 20, cursor: 'pointer',
                  background: 'rgba(255,255,255,.06)',
                  border: '1px solid rgba(255,255,255,.12)',
                  color: 'rgba(255,255,255,.55)',
                  fontSize: 12, transition: 'all .2s',
                }}
              >
                <Copy size={13}/>
                <span>Nusxa</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

//  Fullscreen Modal 
function FullscreenModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, cursor: 'zoom-out',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 10000,
          width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,.12)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}
      >
        <X size={20} />
      </button>

      {/* Label */}
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        fontSize: 12, fontWeight: 700, color: 'rgba(0,212,170,.8)',
        letterSpacing: '.08em', background: 'rgba(0,0,0,.5)',
        padding: '4px 14px', borderRadius: 20, backdropFilter: 'blur(6px)',
      }}>
         FATH AI CHART  Yopish: ESC yoki bosish
      </div>

      {/* Image  click-stop propagation so the image click doesn't close */}
      <img
        src={src}
        alt="chart fullscreen"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '90vh',
          borderRadius: 14, cursor: 'default',
          boxShadow: '0 8px 60px rgba(0,0,0,.7)',
          border: '1px solid rgba(255,255,255,.12)',
        }}
      />
    </div>
  )
}

//  Main Page 
export default function ChatPage() {
  const { user } = useAuth()
  const WELCOME: ChatMessage = {
    id: 'welcome', role: 'assistant', timestamp: Date.now(),
    content: `Salom! Men FATH AI  sizning shaxsiy trading yordamchingizman. \n\nMen quyidagilarga yordamlasha olaman:\n Istalgan juftlik/aktiv tahlili (masalan: "EURUSD H4 tahlil qil")\n Eng yaxshi imkoniyatlar ("Bugun nima savdo qilay?")\n Risk hisoblash ("1000$ bilan lot size necha?")\n Yangiliklar va fundamental tahlil\n Scalping/swing strategiya maslahat\n Chart rasmi yuklang  AI tahlil qiladi!\n\nBoshlaymizmi?`,
  }

  const [messages,    setMessages]    = useState<ChatMessage[]>([WELCOME])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [imageFile,   setImageFile]   = useState<File | null>(null)
  const [imagePreview,setImagePreview]= useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [fullscreen,  setFullscreen]  = useState<string | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load history
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages([WELCOME, ...parsed.map(m => ({ ...m, imagePreview: undefined }))])
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save history
  useEffect(() => {
    try {
      const toStore = messages
        .filter(m => m.id !== 'welcome' && !m.loading)
        .map(m => ({ ...m, imagePreview: undefined, chartBase64: undefined }))
        .slice(-MAX_STORED)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    } catch { /* ignore */ }
  }, [messages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY)
    setMessages([WELCOME])
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 6 * 1024 * 1024) { alert('Rasm 6MB dan kichik bo\'lsin'); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setImagePreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeImage = () => { setImageFile(null); setImagePreview(null); setImageBase64(null) }

  const sendMessage = useCallback(async (text: string) => {
    if ((!text.trim() && !imageFile) || loading) return

    const msgText  = text.trim() || '(Rasmni tahlil qil)'
    const imgB64   = imageBase64 ?? undefined
    const imgMime  = (imageFile?.type ?? 'image/jpeg') as 'image/jpeg'|'image/png'|'image/webp'|'image/gif'
    const imgPrev  = imagePreview ?? undefined

    const userMsg: ChatMessage   = { id: `u-${Date.now()}`, role: 'user',      content: msgText, timestamp: Date.now(), imagePreview: imgPrev }
    const loadMsg: ChatMessage   = { id: `a-${Date.now()}`, role: 'assistant', content: '',       timestamp: Date.now(), loading: true }

    setMessages(prev => [...prev, userMsg, loadMsg])
    setInput(''); removeImage(); setLoading(true)

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const body: Record<string, unknown> = { message: msgText, history }
      if (imgB64) { body.imageBase64 = imgB64; body.imageMimeType = imgMime }
      if (user?.uid) { body.userId = user.uid }

      const res  = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json() as { reply?: string; error?: string; chartBase64?: string; signalData?: ChatSignalData; limitExceeded?: boolean }

      setMessages(prev => prev.map(m =>
        m.id === loadMsg.id
          ? {
              ...m,
              content: data.limitExceeded
                ? `⚠️ ${data.error ?? 'Oylik limitingiz tugadi.'}`
                : (data.reply ?? data.error ?? 'Javob olinmadi'),
              loading: false,
              error: !!data.error,
              chartBase64: data.chartBase64,
              signalData: data.signalData,
            }
          : m
      ))
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === loadMsg.id
          ? { ...m, content: "Tarmoq xatosi. Qayta urinib ko'ring.", loading: false, error: true }
          : m
      ))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [messages, loading, imageFile, imagePreview, imageBase64, user])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  return (
    <>
      {/* Fullscreen modal */}
      {fullscreen && <FullscreenModal src={fullscreen} onClose={() => setFullscreen(null)} />}

      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        maxWidth: 1200, margin: '0 auto', width: '100%',
        background: 'linear-gradient(180deg,#0D0F18 0%,#0A0C14 100%)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 0 20px rgba(0,212,170,.3)', flexShrink: 0,
          }}>
            <Image src="/logo2.png" alt="FATH AI" width={42} height={42} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>FATH AI</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 6px #00D4AA' }} />
              <span style={{ fontSize: 11, color: '#00D4AA', fontWeight: 600 }}>Online</span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={clearHistory} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,77,106,.1)', border: '1px solid rgba(255,77,106,.2)',
              color: '#FF4D6A', fontSize: 11, fontWeight: 600,
            }}>
              <Trash2 size={12}/> Tozalash
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
              background: 'rgba(91,139,255,.1)', border: '1px solid rgba(91,139,255,.2)',
            }}>
              <Zap size={12} color="#5B8BFF"/>
              <span style={{ fontSize: 11, color: '#5B8BFF', fontWeight: 600 }}>FATH AI</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, paddingBottom: 8 }}>
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} onChartClick={setFullscreen} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick actions */}
        <div style={{
          padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,.04)',
          display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0,
        }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.cmd} onClick={() => sendMessage(a.cmd)} disabled={loading} style={{
              padding: '6px 12px', borderRadius: 20,
              background: a.highlight ? 'rgba(246,201,14,.14)' : 'rgba(255,255,255,.05)',
              border: `1px solid ${a.highlight ? 'rgba(246,201,14,.4)' : 'rgba(255,255,255,.1)'}`,
              color: a.highlight ? '#F6C90E' : 'rgba(255,255,255,.7)',
              fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              fontWeight: a.highlight ? 700 : 400,
              boxShadow: a.highlight ? '0 0 10px rgba(246,201,14,.15)' : 'none',
            }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div style={{ padding: '12px 16px 20px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          {imagePreview && (
            <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
              <img src={imagePreview} alt="preview"
                style={{ height: 80, borderRadius: 10, border: '1px solid rgba(91,139,255,.4)', objectFit: 'cover' }} />
              <button onClick={removeImage} style={{
                position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                borderRadius: '50%', border: 'none', background: '#FF4D6A', color: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>
                <X size={12}/>
              </button>
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 16, padding: '10px 14px',
          }}>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={loading} style={{
              width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: imagePreview ? 'rgba(91,139,255,.2)' : 'rgba(255,255,255,.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ImageIcon size={15} color={imagePreview ? '#5B8BFF' : 'rgba(255,255,255,.4)'}/>
            </button>
            <textarea
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey} rows={1}
              placeholder="Savol bering yoki chart rasmi yuklang... (EURUSD H4, XAUUSD signal...)"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#fff', fontSize: 14, resize: 'none', fontFamily: 'inherit',
                lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
              }}
              onInput={e => {
                const el = e.currentTarget; el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && !imageFile)}
              style={{
                width: 38, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: (input.trim() || imageFile) && !loading
                  ? 'linear-gradient(135deg,#00D4AA,#5B8BFF)' : 'rgba(255,255,255,.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Send size={16} color={(input.trim() || imageFile) && !loading ? '#fff' : 'rgba(255,255,255,.3)'}/>
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', textAlign: 'center', marginTop: 8 }}>
            Enter  yuborish  Shift+Enter  yangi qator   Chart rasmi yuklang  AI tahlil qiladi!
          </p>
        </div>

        <style>{`
          @keyframes bounce {
            0%,80%,100% { transform:translateY(0); opacity:.5; }
            40%          { transform:translateY(-6px); opacity:1; }
          }
        `}</style>
      </div>
    </>
  )
}
