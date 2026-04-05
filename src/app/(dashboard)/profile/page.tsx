'use client'
// ============================================================
// /profile — Foydalanuvchi Profili va Sozlamalar
// Barcha o'zgarishlar Firestore ga saqlanadi
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/stores/useAuth'
import {
  User, Bell, Shield, LogOut, Send, Copy, Check,
  Crown, Zap, ChevronRight, AlertCircle, Pencil, X, Loader2, BarChart2,
} from 'lucide-react'
import { logOut } from '@/lib/firebase/auth'
import type { UserNotifSettings } from '@/types'

interface UsageInfo {
  plan: string
  planLabel: string
  monthlyLimit: number
  aiChatUsed: number
  remaining: number
  periodStart: number
  periodEnd: number
  daysLeft: number
  expired: boolean
}

// ─── Constants ─────────────────────────────────────────────────
const PLAN_LABEL: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', vip: 'VIP',
}
const PLAN_COLOR: Record<string, string> = {
  free: '#9D9D9D', starter: '#00D4AA', pro: '#5B8BFF', vip: '#F5B731',
}
const NOTIF_KEYS: { key: keyof UserNotifSettings; label: string; icon: React.ElementType }[] = [
  { key: 'signal_alerts',  label: 'Signal bildirishnomalari',      icon: Zap },
  { key: 'news_alerts',    label: 'Yangiliklar ogohlantirishlari', icon: Bell },
  { key: 'price_alerts',   label: 'Narx ogohlantirishlari',        icon: AlertCircle },
  { key: 'weekly_report',  label: 'Haftalik hisobot',              icon: Shield },
]
const DEFAULT_NOTIFS: UserNotifSettings = {
  signal_alerts: true, news_alerts: true, price_alerts: false, weekly_report: true,
}

// ─── Helpers ───────────────────────────────────────────────────
async function saveProfile(uid: string, data: Record<string, unknown>) {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, ...data }),
  })
  if (!res.ok) throw new Error('save failed')
}

// ─── Sub-components ────────────────────────────────────────────
function Avatar({ name, photoURL, size = 80 }: { name: string; photoURL?: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (photoURL) return (
    <img src={photoURL} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(91,139,255,0.4)', flexShrink: 0 }} />
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#5B8BFF,#9D6FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 800, color: '#fff', border: '3px solid rgba(91,139,255,0.4)', flexShrink: 0 }}>
      {initials || 'T'}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: checked ? '#00D4AA' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: 22, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...style }}>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {children}
    </div>
  )
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  const map = {
    saving: { color: '#F5B731', text: 'Saqlanmoqda...' },
    saved:  { color: '#00D4AA', text: 'Saqlandi ✓' },
    error:  { color: '#FF4D6A', text: 'Xato!' },
  }
  const s = map[state]
  return <span style={{ fontSize: 11, color: s.color, marginLeft: 8 }}>{s.text}</span>
}

// ─── Main Component ────────────────────────────────────────────
export default function ProfilePage() {
  const { user, setUser } = useAuth()

  // displayName edit
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal]         = useState('')
  const [nameSave, setNameSave]       = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const nameRef = useRef<HTMLInputElement>(null)

  // Telegram edit
  const [editingTg, setEditingTg]   = useState(false)
  const [tgVal, setTgVal]           = useState('')
  const [tgSave, setTgSave]         = useState<'idle'|'saving'|'saved'|'error'>('idle')

  // Notifs
  const [notifs, setNotifs]         = useState<UserNotifSettings>(DEFAULT_NOTIFS)
  const [notifSave, setNotifSave]   = useState<'idle'|'saving'|'saved'|'error'>('idle')

  // Referral
  const [copied, setCopied]         = useState(false)

  // Plan usage
  const [usage, setUsage]           = useState<UsageInfo | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  // Init from user profile (Firestore dan)
  useEffect(() => {
    if (!user) return
    setNotifs(user.notifSettings ?? DEFAULT_NOTIFS)
    setNameVal(user.displayName)
    setTgVal(user.telegramUsername ?? '')

    // Plan usage ni yuklash
    setUsageLoading(true)
    fetch(`/api/profile/usage?uid=${user.uid}`)
      .then(r => r.json())
      .then((data: UsageInfo) => { setUsage(data); setUsageLoading(false) })
      .catch(() => setUsageLoading(false))
  }, [user])

  // Focus name input on edit
  useEffect(() => {
    if (editingName) nameRef.current?.focus()
  }, [editingName])

  // ── Handlers ─────────────────────────────────────────────────
  const saveName = async () => {
    if (!user || !nameVal.trim() || nameVal === user.displayName) { setEditingName(false); return }
    setNameSave('saving')
    try {
      await saveProfile(user.uid, { displayName: nameVal.trim() })
      setUser({ ...user, displayName: nameVal.trim() })
      setNameSave('saved')
      setEditingName(false)
      setTimeout(() => setNameSave('idle'), 2000)
    } catch { setNameSave('error'); setTimeout(() => setNameSave('idle'), 2000) }
  }

  const saveTelegram = async () => {
    if (!user) return
    const val = tgVal.replace('@', '').trim()
    setTgSave('saving')
    try {
      await saveProfile(user.uid, { telegramUsername: val })
      setUser({ ...user, telegramUsername: val || undefined })
      setTgSave('saved')
      setEditingTg(false)
      setTgVal(val)
      setTimeout(() => setTgSave('idle'), 2000)
    } catch { setTgSave('error'); setTimeout(() => setTgSave('idle'), 2000) }
  }

  const updateNotif = async (key: keyof UserNotifSettings, val: boolean) => {
    if (!user) return
    const updated = { ...notifs, [key]: val }
    setNotifs(updated)
    setNotifSave('saving')
    try {
      await saveProfile(user.uid, { notifSettings: updated })
      setUser({ ...user, notifSettings: updated })
      setNotifSave('saved')
      setTimeout(() => setNotifSave('idle'), 1500)
    } catch { setNotifSave('error'); setTimeout(() => setNotifSave('idle'), 2000) }
  }

  const copyReferral = () => {
    if (!user?.referralCode) return
    navigator.clipboard.writeText(`https://traderai.uz/?ref=${user.referralCode}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => {})
  }

  // ── Render ───────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.4)' }}>
        <Loader2 size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p>Profil yuklanmoqda...</p>
      </div>
    )
  }

  const planColor = PLAN_COLOR[user.plan] ?? '#9D9D9D'
  const planLabel = PLAN_LABEL[user.plan] ?? user.plan

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Profile Card ── */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Avatar name={user.displayName} photoURL={user.photoURL} size={80} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input
                  ref={nameRef}
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  maxLength={80}
                  style={{ fontSize: 18, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(91,139,255,0.5)', borderRadius: 8, padding: '4px 10px', outline: 'none', flex: 1 }}
                />
                <button onClick={saveName} disabled={nameSave === 'saving'} style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#5B8BFF', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {nameSave === 'saving' ? '...' : 'Saqlash'}
                </button>
                <button onClick={() => { setEditingName(false); setNameVal(user.displayName) }} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{user.displayName}</h1>
                <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4 }}>
                  <Pencil size={14} />
                </button>
                <SaveIndicator state={nameSave} />
              </div>
            )}
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{user.email}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: `${planColor}18`, border: `1px solid ${planColor}35` }}>
                <Crown size={12} color={planColor} />
                <span style={{ fontSize: 12, fontWeight: 700, color: planColor }}>{planLabel} Plan</span>
              </div>
              {user.role === 'admin' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(245,183,49,0.12)', border: '1px solid rgba(245,183,49,0.25)' }}>
                  <Shield size={12} color="#F5B731" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F5B731' }}>Admin</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Obuna holati ── */}
      <SectionCard>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crown size={15} color={planColor} /> Obuna holati
        </h2>
        <Row>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Joriy reja</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: planColor }}>{planLabel}</span>
        </Row>
        <Row>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Holat</span>
          {usage?.expired ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#FF4D6A', fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF4D6A', display: 'inline-block' }} />
              Muddati tugagan
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#00D4AA', fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 6px #00D4AA', display: 'inline-block' }} />
              Faol
            </span>
          )}
        </Row>

        {/* AI Chat usage bar */}
        {usageLoading ? (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Yuklanmoqda...
          </div>
        ) : usage ? (
          <div style={{ marginTop: 16 }}>
            {/* AI Chat limit */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BarChart2 size={12} /> Oylik AI Chat
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: usage.remaining === 0 ? '#FF4D6A' : planColor }}>
                  {usage.aiChatUsed} / {usage.monthlyLimit}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round((usage.aiChatUsed / usage.monthlyLimit) * 100))}%`,
                  borderRadius: 6,
                  background: usage.remaining === 0
                    ? '#FF4D6A'
                    : usage.aiChatUsed / usage.monthlyLimit > 0.75
                      ? '#F5B731'
                      : planColor,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {usage.remaining} ta qoldi
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {usage.daysLeft} kun qoldi
                </span>
              </div>
            </div>

            {/* Limit tugagan bo'lsa */}
            {usage.remaining === 0 && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', fontSize: 12, color: '#FF4D6A', marginBottom: 10 }}>
                ⚠️ Oylik AI chat limitingiz tugadi. Yangi tarif sotib olish orqali davom eting.
              </div>
            )}

            {/* Muddati tugagan bo'lsa */}
            {usage.expired && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', fontSize: 12, color: '#FF4D6A', marginBottom: 10 }}>
                ⚠️ Tarifingiz muddati tugagan. Aktivlashtirish uchun tarif sotib oling.
              </div>
            )}
          </div>
        ) : null}

        {user.plan === 'free' && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 12, background: 'rgba(91,139,255,0.08)', border: '1px solid rgba(91,139,255,0.2)' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>Pro rejasiga o'ting — ko'proq AI chat va signal imkoniyatlari!</p>
            <a href="/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#5B8BFF,#9D6FFF)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <Crown size={13} /> Upgrade qilish <ChevronRight size={13} />
            </a>
          </div>
        )}
      </SectionCard>

      {/* ── Telegram ── */}
      <SectionCard>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={15} color="#1DA1F2" /> Telegram ulanish
          <SaveIndicator state={tgSave} />
        </h2>
        {user.telegramUsername && !editingTg ? (
          <Row>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Ulangan hisob:</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1DA1F2' }}>@{user.telegramUsername}</span>
            </div>
            <button onClick={() => { setEditingTg(true); setTgVal(user.telegramUsername ?? '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4 }}>
              <Pencil size={14} />
            </button>
          </Row>
        ) : editingTg ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '0 12px' }}>
              <span style={{ color: '#1DA1F2', fontSize: 14, marginRight: 4 }}>@</span>
              <input
                value={tgVal}
                onChange={e => setTgVal(e.target.value.replace('@', ''))}
                onKeyDown={e => { if (e.key === 'Enter') saveTelegram(); if (e.key === 'Escape') setEditingTg(false) }}
                placeholder="telegram_username"
                maxLength={50}
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, padding: '10px 0', flex: 1 }}
              />
            </div>
            <button onClick={saveTelegram} disabled={tgSave === 'saving'} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#1DA1F2', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              {tgSave === 'saving' ? '...' : 'Saqlash'}
            </button>
            <button onClick={() => setEditingTg(false)} style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 280 }}>Username kiriting yoki bot orqali signallarni Telegram da oling.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setEditingTg(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(29,161,242,0.3)', background: 'rgba(29,161,242,0.1)', color: '#1DA1F2', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Pencil size={13} /> Username kiritish
              </button>
              <a href="https://t.me/trader_ai_bot" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, background: '#1DA1F2', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                <Send size={13} /> Botga o&apos;tish
              </a>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Bildirishnomalar ── */}
      <SectionCard>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={15} color="#9D6FFF" /> Bildirishnomalar
          <SaveIndicator state={notifSave} />
        </h2>
        {NOTIF_KEYS.map(({ key, label, icon: Icon }) => (
          <Row key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon size={14} color="rgba(255,255,255,0.4)" />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
            </div>
            <ToggleSwitch checked={notifs[key]} onChange={val => updateNotif(key, val)} />
          </Row>
        ))}
      </SectionCard>

      {/* ── Referal ── */}
      {user.referralCode && (
        <SectionCard>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={15} color="#00D4AA" /> Referal havola
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Do&apos;stingizni taklif qiling va bonus oling!</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: '#00D4AA', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              traderai.uz/?ref={user.referralCode}
            </div>
            <button onClick={copyReferral} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: copied ? '#00D4AA' : 'rgba(0,212,170,0.15)', color: '#00D4AA', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, flexShrink: 0, transition: 'all 0.2s' }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Nusxalandi' : 'Nusxalash'}
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── Hisob ma'lumotlari ── */}
      <SectionCard>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={15} color="rgba(255,255,255,0.5)" /> Hisob ma&apos;lumotlari
        </h2>
        <Row>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Ro&apos;yxatdan o&apos;tgan</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{new Date(user.createdAt).toLocaleDateString('uz')}</span>
        </Row>
        <Row>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Oxirgi faollik</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{new Date(user.lastSeen).toLocaleDateString('uz')}</span>
        </Row>
        <Row>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>UID</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{user.uid.slice(0, 16)}...</span>
        </Row>
      </SectionCard>

      {/* ── Chiqish ── */}
      <button
        onClick={() => logOut()}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 14, border: '1px solid rgba(255,77,106,0.25)', background: 'rgba(255,77,106,0.06)', color: '#FF4D6A', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', transition: 'background 0.2s' }}
        onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,77,106,0.12)' }}
        onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(255,77,106,0.06)' }}
      >
        <LogOut size={15} /> Chiqish
      </button>
    </div>
  )
}
