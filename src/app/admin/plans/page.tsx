'use client'
// ============================================================
// /admin/plans — Tarif Rejalari Boshqaruvi
// Firestore /plans/ kolleksiyasi CRUD + Promo kodlar
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Check, Tag, RefreshCw } from 'lucide-react'

interface Plan {
  id: string
  name: string
  displayName: string
  price: number
  currency: string
  period: 'monthly' | 'yearly' | 'lifetime'
  features: string[]
  limits: {
    dailySignals: number
    aiChatLimit: number
    backtestAccess: boolean
    multiTimeframe: boolean
    fundamentalAnalysis: boolean
    telegramSignal: boolean
    apiAccess: boolean
    prioritySignal: boolean
  }
  active: boolean
  trialDays: number
  sortOrder: number
}

interface PromoCode {
  id: string
  code: string
  discountPercent: number
  maxUses: number
  usedCount: number
  expiresAt: string
  active: boolean
  planId?: string
}

const DEFAULT_LIMITS: Plan['limits'] = {
  dailySignals: 3, aiChatLimit: 10, backtestAccess: false,
  multiTimeframe: false, fundamentalAnalysis: false,
  telegramSignal: false, apiAccess: false, prioritySignal: false,
}


function PlanCard({ plan, onEdit, onDelete, onToggle }: {
  plan: Plan
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const limitList = [
    { key: 'dailySignals', label: `${plan.limits.dailySignals} ta signal (oylik)` },
    { key: 'aiChatLimit',  label: `${plan.limits.aiChatLimit} ta oylik AI chat` },
  ]

  const planColors: Record<string, string> = {
    free: '#6b7280', premium: '#F5B731', pro: '#9D6FFF', ultimate: '#00D4AA'
  }
  const color = planColors[plan.name] ?? '#5B8BFF'

  return (
    <div style={{
      background: '#0d1117', border: `1px solid ${plan.active ? color + '30' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{plan.displayName}</h3>
            {!plan.active && (
              <span style={{ fontSize: 10, background: 'rgba(107,114,128,0.2)', color: '#6b7280', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>
                Yopiq
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color }}>${plan.price}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>/{plan.period === 'monthly' ? 'oy' : plan.period === 'yearly' ? 'yil' : 'bir martalik'}</span>
          </div>
          {plan.trialDays > 0 && (
            <span style={{ fontSize: 11, color: '#00D4AA', marginTop: 4, display: 'block' }}>
              ✅ {plan.trialDays} kun bepul sinov
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onToggle} style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: plan.active ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)',
            border: `1px solid ${plan.active ? 'rgba(0,212,170,0.3)' : 'rgba(255,77,106,0.3)'}`,
            color: plan.active ? '#00D4AA' : '#FF4D6A',
          }}>{plan.active ? 'Yoqiq' : 'O\'chiriq'}</button>
          <button onClick={onEdit} style={{
            padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(91,139,255,0.1)', border: '1px solid rgba(91,139,255,0.2)', color: '#5B8BFF',
          }}><Edit2 size={13} /></button>
          <button onClick={onDelete} style={{
            padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)', color: '#FF4D6A',
          }}><Trash2 size={13} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {limitList.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={13} color={color} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanModal({ plan, onClose, onSave }: { plan: Partial<Plan> | null; onClose: () => void; onSave: (p: Partial<Plan> & { pricePolicy?: string }) => void }) {
  const [form, setForm] = useState<Partial<Plan>>(plan ?? {
    name: '', displayName: '', price: 0, currency: 'USD', period: 'monthly',
    features: [], limits: { ...DEFAULT_LIMITS }, active: true, trialDays: 0, sortOrder: 0,
  })
  const [pricePolicy, setPricePolicy] = useState<'grandfather' | 'immediate' | 'grace30' | 'grace90'>('grace30')
  const isEditing = Boolean(plan?.id)
  const priceChanged = isEditing && form.price !== plan?.price

  const setLimit = (k: keyof Plan['limits'], v: boolean | number) => {
    setForm(f => ({ ...f, limits: { ...f.limits, ...DEFAULT_LIMITS, [k]: v } }))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18, padding: 28, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 20 }}>
          {plan?.id ? 'Tarifni Tahrirlash' : 'Yangi Tarif'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Nomi (key)</label>
              <input className="admin-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="free, premium, pro" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Ko'rsatiladigan nom</label>
              <input className="admin-input" value={form.displayName ?? ''} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Free Plan" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Narx ($)</label>
              <input className="admin-input" type="number" value={form.price ?? 0} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Davr</label>
              <select className="admin-input" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value as Plan['period'] }))}>
                <option value="monthly">Oylik</option>
                <option value="yearly">Yillik</option>
                <option value="lifetime">Bir martalik</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Trial kunlar</label>
              <input className="admin-input" type="number" value={form.trialDays ?? 0} onChange={e => setForm(f => ({ ...f, trialDays: Number(e.target.value) }))} />
            </div>
          </div>

          {/* Narx o'zgartirish policy — faqat editda va narx o'zgarganda */}
          {isEditing && priceChanged && (
            <div style={{ background: 'rgba(245,183,49,0.06)', border: '1px solid rgba(245,183,49,0.25)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F5B731', marginBottom: 10 }}>
                ⚠️ Narx o&apos;zgaryapti: ${plan?.price ?? '?'} → ${form.price}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Mavjud abonentlar uchun qaysi siyosat qo&apos;llansin?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  ['grandfather', 'Grandfather — avvalgi narxni saqlasin (hech narsa o\'zgarmaydi)'],
                  ['immediate',   'Darhol — yangi narx hoziroq qo\'llansin'],
                  ['grace30',     '30 kun muhlat — 30 kun ichida yangi narxga o\'tsin'],
                  ['grace90',     '90 kun muhlat — 90 kun ichida yangi narxga o\'tsin'],
                ] as const).map(([val, label]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" name="pricePolicy" value={val} checked={pricePolicy === val}
                      onChange={() => setPricePolicy(val)} style={{ accentColor: '#F5B731' }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>Limitlar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Oylik signal limiti</label>
              <input className="admin-input" type="number" value={form.limits?.dailySignals ?? 3} onChange={e => setLimit('dailySignals', Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Oylik AI Chat limiti</label>
              <input className="admin-input" type="number" value={form.limits?.aiChatLimit ?? 10} onChange={e => setLimit('aiChatLimit', Number(e.target.value))} />
            </div>
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>Imkoniyatlar</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              ['telegramSignal',      'Telegram signal bildirish'],
              ['fundamentalAnalysis', 'Fundamental tahlil'],
              ['prioritySignal',      'Priority signal'],
              ['backtestAccess',      'Backtest kirish'],
              ['multiTimeframe',      'Ko\'p vaqt oralig\'i'],
              ['apiAccess',           'API kirish'],
            ] as const).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: form.limits?.[key] ? 'rgba(0,212,170,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${form.limits?.[key] ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
                <input type="checkbox" checked={!!form.limits?.[key]} onChange={e => setLimit(key, e.target.checked)} style={{ accentColor: '#00D4AA', width: 16, height: 16, cursor: 'pointer' }} />
              </label>
            ))}
          </div>


        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 13,
          }}>Bekor</button>
          <button onClick={() => onSave({ ...form, pricePolicy })} style={{
            flex: 2, padding: '10px', borderRadius: 10, cursor: 'pointer',
            background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
          }}>Saqlash</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPlansPage() {
  const [plans, setPlans]         = useState<Plan[]>([])
  const [promos, setPromos]       = useState<PromoCode[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'plans' | 'promos'>('plans')
  const [editingPlan, setEditing] = useState<Partial<Plan> | null | false>(false)
  const [msg, setMsg]             = useState('')

  // Promo form
  const [promoForm, setPromoForm] = useState({ code: '', discountPercent: 20, maxUses: 100, expiresAt: '', active: true })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, prRes] = await Promise.all([
        fetch('/api/admin/plans'),
        fetch('/api/admin/promos'),
      ])
      const [pData, prData] = await Promise.all([pRes.json(), prRes.json()]) as [{ plans?: Plan[] }, { promos?: PromoCode[] }]
      setPlans(pData.plans ?? [])
      setPromos(prData.promos ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const savePlan = async (form: Partial<Plan> & { pricePolicy?: string }) => {
    const method = form.id ? 'PATCH' : 'POST'
    const res    = await fetch('/api/admin/plans', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json() as { error?: string; priceChanged?: boolean; affectedCount?: number }
    if (data.error) { setMsg('Xato: ' + data.error); return }
    const priceMsg = data.priceChanged ? ` | ${data.affectedCount} ta abonentga narx o'zgarishi xabarnomasi yuborildi` : ''
    setMsg('✅ Saqlandi' + priceMsg)
    setEditing(false)
    loadData()
  }

  const togglePlan = async (plan: Plan) => {
    await fetch('/api/admin/plans', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: plan.id, active: !plan.active }),
    })
    loadData()
  }

  const deletePlan = async (id: string) => {
    if (!confirm('Tarifni o\'chirasizmi?')) return
    await fetch(`/api/admin/plans?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  const createPromo = async () => {
    if (!promoForm.code.trim()) return
    const res  = await fetch('/api/admin/promos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(promoForm),
    })
    const data = await res.json() as { error?: string }
    if (data.error) { setMsg('Xato: ' + data.error); return }
    setMsg('✅ Promo kod yaratildi')
    setPromoForm({ code: '', discountPercent: 20, maxUses: 100, expiresAt: '', active: true })
    loadData()
  }

  const togglePromo = async (promo: PromoCode) => {
    await fetch('/api/admin/promos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: promo.id, active: !promo.active }),
    })
    loadData()
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Tarif va Obuna</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Tariflar, chegirmalar va sinov davrlarini boshqaring</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadData} style={{ padding: '8px 14px', borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} />
          </button>
          {tab === 'plans' && (
            <button onClick={() => setEditing({})} style={{ padding: '8px 16px', borderRadius: 10, cursor: 'pointer', background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Yangi Tarif
            </button>
          )}
        </div>
      </div>

      {msg && <div style={{ padding: '10px 16px', borderRadius: 10, background: msg.startsWith('✅') ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(0,212,170,0.3)' : 'rgba(255,77,106,0.3)'}`, color: msg.startsWith('✅') ? '#00D4AA' : '#FF4D6A', fontSize: 13 }}>{msg}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 0 }}>
        {(['plans', 'promos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '12px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none',
            color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
            borderBottom: tab === t ? '2px solid #00D4AA' : '2px solid transparent',
          }}>
            {t === 'plans' ? '💳 Tarif Rejalari' : `🏷️ Promo Kodlar (${promos.length})`}
          </button>
        ))}
      </div>

      {tab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 300, borderRadius: 16, background: 'rgba(255,255,255,0.03)' }} />
              ))
            : plans.length === 0
              ? <p style={{ color: 'rgba(255,255,255,0.4)', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>Hozircha tarif yo'q. Yangi tarif qo'shing.</p>
              : plans.sort((a, b) => a.sortOrder - b.sortOrder).map(p => (
                  <PlanCard key={p.id} plan={p}
                    onEdit={() => setEditing(p)}
                    onDelete={() => deletePlan(p.id)}
                    onToggle={() => togglePlan(p)}
                  />
                ))
          }
        </div>
      )}

      {tab === 'promos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Create promo */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              <Tag size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Yangi Promo Kod
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <input className="admin-input" placeholder="Kod (masalan: SAVE20)" value={promoForm.code} onChange={e => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} style={{ fontFamily: 'monospace', fontWeight: 700 }} />
              <input className="admin-input" type="number" placeholder="Chegirma %" min={1} max={100} value={promoForm.discountPercent} onChange={e => setPromoForm(f => ({ ...f, discountPercent: Number(e.target.value) }))} />
              <input className="admin-input" type="number" placeholder="Max foydalanish" value={promoForm.maxUses} onChange={e => setPromoForm(f => ({ ...f, maxUses: Number(e.target.value) }))} />
              <input className="admin-input" type="date" value={promoForm.expiresAt} onChange={e => setPromoForm(f => ({ ...f, expiresAt: e.target.value }))} />
              <button onClick={createPromo} style={{ padding: '10px', borderRadius: 10, cursor: 'pointer', background: 'linear-gradient(135deg, #F5B731, #FF6B35)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                + Yaratish
              </button>
            </div>
          </div>

          {/* Promos list */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Kod', 'Chegirma', 'Foydalanildi', 'Amal qilish', 'Holat', 'Amallar'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promos.map(pr => (
                  <tr key={pr.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#F5B731' }}>{pr.code}</td>
                    <td style={{ padding: '12px 8px', color: '#00D4AA', fontWeight: 700 }}>{pr.discountPercent}%</td>
                    <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{pr.usedCount ?? 0}/{pr.maxUses}</td>
                    <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{pr.expiresAt || '♾️'}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700, background: pr.active ? 'rgba(0,212,170,0.1)' : 'rgba(107,114,128,0.1)', color: pr.active ? '#00D4AA' : '#6b7280' }}>
                        {pr.active ? 'Faol' : 'Nofaol'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => togglePromo(pr)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', background: 'rgba(91,139,255,0.1)', border: '1px solid rgba(91,139,255,0.2)', color: '#5B8BFF', fontWeight: 600 }}>
                        {pr.active ? 'O\'chir' : 'Yoq'}
                      </button>
                    </td>
                  </tr>
                ))}
                {promos.length === 0 && !loading && (
                  <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Promo kodlar yo'q</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingPlan !== false && (
        <PlanModal
          plan={editingPlan || null}
          onClose={() => setEditing(false)}
          onSave={savePlan}
        />
      )}

      <style>{`
        .admin-input {
          width: 100%; padding: 10px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #fff; font-size: 13px; outline: none; box-sizing: border-box;
        }
        .admin-input:focus { border-color: rgba(91,139,255,0.4); }
        .admin-input option { background: #0d1117; }
      `}</style>
    </div>
  )
}
