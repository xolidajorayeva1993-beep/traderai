'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Key, Bell, Globe, Shield, Save, Database, RefreshCw, CreditCard, Eye, EyeOff } from 'lucide-react'

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: 20, marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({
  label, value, onChange, masked = false, readOnly = false, placeholder,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  masked?: boolean; readOnly?: boolean; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type={masked && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          style={{
            flex: 1, background: readOnly ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '8px 12px', color: readOnly ? 'rgba(255,255,255,0.4)' : '#fff',
            fontSize: 13, outline: 'none', fontFamily: masked ? 'monospace' : 'inherit',
          }}
        />
        {masked && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '8px 12px',
              cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
          background: value ? '#5B8BFF' : 'rgba(255,255,255,0.12)', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

const DEFAULT: Record<string, string | boolean> = {
  openaiKey: '', geminiKey: '', twelveDataKey: '', cryptoPanicKey: '',
  telegramToken: '', telegramChannelId: '@trader_ai_signals', telegramAdminChatId: '',
  platformName: 'FATH AI', aiBrandName: 'FATH AI',
  disclaimer: "Bu moliyaviy maslahat emas.",
  paymeMode: false,
  paymeMerchantId: '', paymeSecretKey: '',
  paymeMerchantIdTest: '', paymeSecretKeyTest: '',
  clickServiceId: '', clickMerchantId: '', clickSecretKey: '',
  stripePriceIdPro: '', stripePriceIdVip: '',
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string | boolean>>(DEFAULT)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [tab, setTab] = useState<'general' | 'payment' | 'security' | 'api'>('general')
  const [secLogs, setSecLogs] = useState<Array<{ action: string; uid?: string; ip?: string; ts: string }>>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<Record<string, { ok: boolean; latency?: number; msg?: string }> | null>(null)
  const [apiLoading, setApiLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then((d: Record<string, string | boolean>) => {
        setSettings(s => ({ ...s, ...d }))
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoading(false))
  }, [])

  const set = (key: string) => (v: string | boolean) => setSettings(s => ({ ...s, [key]: v }))
  const str = (key: string) => String(settings[key] ?? '')

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const loadSecurityLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res  = await fetch('/api/admin/security-logs')
      const data = await res.json() as { logs?: Array<{ action: string; uid?: string; ip?: string; ts: string }> }
      setSecLogs(data.logs ?? [])
    } finally { setLogsLoading(false) }
  }, [])

  const loadApiStatus = async () => {
    setApiLoading(true)
    try {
      const res  = await fetch('/api/admin/monitoring')
      const data = await res.json() as { services?: Array<{ name: string; status: string; latency?: number; message?: string }> }
      const statusMap: Record<string, { ok: boolean; latency?: number; msg?: string }> = {}
      for (const svc of (data.services ?? [])) {
        statusMap[svc.name] = { ok: svc.status === 'ok', latency: svc.latency, msg: svc.message }
      }
      setApiStatus(statusMap)
    } finally { setApiLoading(false) }
  }

  useEffect(() => {
    if (tab === 'security') loadSecurityLogs()
    if (tab === 'api') loadApiStatus()
  }, [tab, loadSecurityLogs])

  const tabs = [
    { id: 'general',  icon: <Settings size={13} />,  label: 'Umumiy' },
    { id: 'payment',  icon: <CreditCard size={13} />, label: "To'lov Tizimlari" },
    { id: 'security', icon: <Shield size={13} />,     label: 'Xavfsizlik Loglari' },
    { id: 'api',      icon: <Key size={13} />,        label: 'API Holati' },
  ] as const

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        Yuklanmoqda...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Tizim Sozlamalari</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>API kalitlar, to&apos;lov tizimlari va xavfsizlik</p>
        </div>
        {(tab === 'general' || tab === 'payment') && (
          <button onClick={handleSave} disabled={saving} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10,
            background: saved ? 'rgba(0,212,170,0.15)' : 'rgba(91,139,255,0.15)',
            border: saved ? '1px solid rgba(0,212,170,0.4)' : '1px solid rgba(91,139,255,0.4)',
            color: saved ? '#00D4AA' : '#5B8BFF', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <Save size={14} />{saved ? 'Saqlandi \u2713' : saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '11px 18px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', background: 'none', border: 'none',
            color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.4)',
            borderBottom: tab === t.id ? '2px solid #5B8BFF' : '2px solid transparent',
          }}>{t.icon}{t.label}</button>
        ))}
      </div>

      {/* GENERAL TAB */}
      {tab === 'general' && (
        <div className="g-2col">
          <div>
            <Section title={<><Key size={13} style={{ marginRight: 6 }} />API Kalitlari</>}>
              <Field label="OpenAI API Key"        value={str('openaiKey')}      onChange={set('openaiKey')}      masked placeholder="sk-..." />
              <Field label="Google Gemini API Key" value={str('geminiKey')}      onChange={set('geminiKey')}      masked placeholder="AIza..." />
              <Field label="Twelve Data API Key"   value={str('twelveDataKey')}  onChange={set('twelveDataKey')}  masked />
              <Field label="CryptoPanic API Key"   value={str('cryptoPanicKey')} onChange={set('cryptoPanicKey')} masked />
            </Section>
            <Section title={<><Bell size={13} style={{ marginRight: 6 }} />Telegram Bot</>}>
              <Field label="Bot Token"     value={str('telegramToken')}       onChange={set('telegramToken')}       masked placeholder="7...:AAF..." />
              <Field label="Kanal ID"      value={str('telegramChannelId')}   onChange={set('telegramChannelId')}   placeholder="@trader_ai_signals" />
              <Field label="Admin Chat ID" value={str('telegramAdminChatId')} onChange={set('telegramAdminChatId')} placeholder="12345678" />
            </Section>
          </div>
          <div>
            <Section title={<><Globe size={13} style={{ marginRight: 6 }} />Platforma</>}>
              <Field label="Platforma nomi"     value={str('platformName')} onChange={set('platformName')} />
              <Field label="AI brend nomi"       value={str('aiBrandName')}  onChange={set('aiBrandName')}  />
              <Field label="Rad etish matni"     value={str('disclaimer')}   onChange={set('disclaimer')}   />
            </Section>
            <Section title={<><Database size={13} style={{ marginRight: 6 }} />Tizim</>}>
              {[['Next.js', '14 App Router'], ['Firebase', 'Ulangan'], ['Firestore', 'Ulangan'], ['Auth', 'Ulangan'], ['Build', 'Production']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{l}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#00D4AA' }}>{v}</span>
                </div>
              ))}
            </Section>
          </div>
        </div>
      )}

      {/* PAYMENT TAB */}
      {tab === 'payment' && (
        <div className="g-2col">
          <div>
            <Section title="Payme (Paycom)">
              <Toggle
                label="Production rejimi (o'chirsa Test)"
                value={Boolean(settings.paymeMode)}
                onChange={set('paymeMode')}
              />
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 14, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Joriy rejim: <strong style={{ color: settings.paymeMode ? '#00D4AA' : '#F5B731' }}>{settings.paymeMode ? 'Production' : 'Test'}</strong>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Test muhit</div>
              <Field label="Test Merchant ID"  value={str('paymeMerchantIdTest')} onChange={set('paymeMerchantIdTest')} masked placeholder="60e0ef52..." />
              <Field label="Test Secret Key"   value={str('paymeSecretKeyTest')}  onChange={set('paymeSecretKeyTest')}  masked />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, marginTop: 8 }}>Production muhit</div>
              <Field label="Production Merchant ID" value={str('paymeMerchantId')} onChange={set('paymeMerchantId')} masked />
              <Field label="Production Secret Key"  value={str('paymeSecretKey')}  onChange={set('paymeSecretKey')}  masked />
              <Field label="Webhook URL (o'zgarmas)" value="/api/payment/payme" readOnly />
            </Section>
          </div>
          <div>
            <Section title="Click (UzCard / Humo)">
              <Field label="Service ID"  value={str('clickServiceId')}  onChange={set('clickServiceId')}  placeholder="12345" />
              <Field label="Merchant ID" value={str('clickMerchantId')} onChange={set('clickMerchantId')} placeholder="12345" />
              <Field label="Secret Key"  value={str('clickSecretKey')}  onChange={set('clickSecretKey')}  masked />
            </Section>
            <Section title="Stripe">
              <Field label="Price ID - Pro" value={str('stripePriceIdPro')} onChange={set('stripePriceIdPro')} masked placeholder="price_..." />
              <Field label="Price ID - VIP" value={str('stripePriceIdVip')} onChange={set('stripePriceIdVip')} masked placeholder="price_..." />
            </Section>
          </div>
        </div>
      )}

      {/* SECURITY LOGS TAB */}
      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>So&apos;nggi admin harakatlari va tizim xavfsizlik loglari</p>
            <button onClick={loadSecurityLogs} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              <RefreshCw size={12} /> Yangilash
            </button>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Harakat', 'Foydalanuvchi UID', 'IP Manzil', 'Vaqt'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logsLoading && (
                  <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Yuklanmoqda...</td></tr>
                )}
                {!logsLoading && secLogs.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Hozircha log yo&apos;q</td></tr>
                )}
                {secLogs.map((log, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#fff' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                        background: log.action.includes('delete') ? 'rgba(255,77,106,0.1)' : log.action.includes('login') ? 'rgba(0,212,170,0.1)' : 'rgba(91,139,255,0.1)',
                        color: log.action.includes('delete') ? '#FF4D6A' : log.action.includes('login') ? '#00D4AA' : '#5B8BFF',
                      }}>{log.action}</span>
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>{log.uid ?? '\u2014'}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{log.ip ?? '\u2014'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{new Date(log.ts).toLocaleString('uz-UZ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* API STATUS TAB */}
      {tab === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Tashqi API xizmatlar holati va so&apos;nggi tekshiruv</p>
            <button onClick={loadApiStatus} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(91,139,255,0.1)', border: '1px solid rgba(91,139,255,0.3)', color: '#5B8BFF', fontSize: 12 }}>
              <RefreshCw size={12} /> Tekshirish
            </button>
          </div>
          {apiLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Tekshirilmoqda...</div>
          ) : apiStatus ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {Object.entries(apiStatus).map(([name, { ok, latency, msg }]) => (
                <div key={name} style={{ background: '#0d1117', border: `1px solid ${ok ? 'rgba(0,212,170,0.2)' : 'rgba(255,77,106,0.2)'}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: ok ? '#00D4AA' : '#FF4D6A' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'capitalize' }}>{name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: ok ? '#00D4AA' : '#FF4D6A', fontWeight: 600 }}>{ok ? 'Ulangan' : 'Xato'}</div>
                  {latency !== undefined && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{latency}ms</div>}
                  {msg && !ok && <div style={{ fontSize: 11, color: 'rgba(255,77,106,0.7)', marginTop: 4, wordBreak: 'break-word' }}>{msg.slice(0, 80)}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, background: '#0d1117', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>&quot;Tekshirish&quot; tugmasini bosing</div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.08em' }}>API Rate Limitlar</h3>
            {[['OpenAI GPT-4o', '10,000 req/min', '#00D4AA'], ['Google Gemini', '1,500 req/min', '#4285F4'], ['Twelve Data', '800 req/day', '#F5B731'], ['Telegram Bot', 'Unlimited', '#9D6FFF']].map(([api, limit, color]) => (
              <div key={api} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{api}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color }}>{limit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}