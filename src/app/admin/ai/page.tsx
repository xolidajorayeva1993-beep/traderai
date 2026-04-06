'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, Sliders, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Zap, RefreshCw, BarChart2, Terminal, AlertCircle, Send, Trash2 } from 'lucide-react'

interface ModelStat {
  model: string
  calls: number
  tokens: number
  successRate: number
  avgLatency: number
}

interface AiParams {
  temperature: number
  maxTokens: number
  topP: number
  minConfluence: number
  strongThreshold: number
  conflictTol: number
  techVsFundamental: number
}

const DEFAULT_PARAMS: AiParams = {
  temperature: 0.3,
  maxTokens: 2000,
  topP: 0.95,
  minConfluence: 60,
  strongThreshold: 75,
  conflictTol: 20,
  techVsFundamental: 60,
}

// Strategiya og'irliklari (confluence.ts da DEFAULT_WEIGHTS ga mos)
const STRATEGIES = [
  { key: 'indicators', label: 'Texnik Indikatorlar', desc: 'RSI, MACD, EMA, Bollinger Bands, Stochastic', defaultWeight: 20, color: '#5B8BFF' },
  { key: 'snr',        label: 'SNR (S&R Zones)',     desc: 'Support va Resistance zonalar bouncing',      defaultWeight: 25, color: '#00D4AA' },
  { key: 'patterns',   label: 'Chart Patterns',       desc: 'Candlestick va klassik chart formatsiyalar', defaultWeight: 15, color: '#F5B731' },
  { key: 'trendline',  label: 'Trendline Analiz',     desc: 'Linear regression, breakout, channel',       defaultWeight: 15, color: '#9D6FFF' },
  { key: 'fibonacci',  label: 'Fibonacci',            desc: 'Retracement (61.8%, 38.2%) va Extension',    defaultWeight: 10, color: '#FF4D6A' },
  { key: 'gann',       label: 'Gann Analiz',          desc: 'Fan angles va Square of 9 darajalar',        defaultWeight:  5, color: '#06b6d4' },
  { key: 'smc',        label: 'Smart Money (SMC)',     desc: 'BOS, CHoCH, FVG, Liquidity Sweep',          defaultWeight: 10, color: '#a78bfa' },
]

const MODELS = [
  { id: 'gpt-4o-mini',    label: 'GPT-4o Mini',    badge: 'Tez В· Arzon',    color: '#10B981', desc: 'Oddiy signallar, kunlik skanlar uchun ($0.15/1M token)' },
  { id: 'gpt-4o',         label: 'GPT-4o',          badge: 'Chuqur',         color: '#F5B731', desc: 'Murakkab tahlil, kuchli signal uchun ($2.5/1M token)' },
  { id: 'gemini-2.0-flash',label: 'Gemini 2.0 Flash',badge: 'Bepul',         color: '#5B8BFF', desc: '15 req/daqiqa, bepul tier вЂ” ikkinchi tahlilchi' },
]

function StrategyCard({
  strategy,
  weight,
  active,
  onWeightChange,
  onToggle,
}: {
  strategy: typeof STRATEGIES[0]
  weight: number
  active: boolean
  onWeightChange: (v: number) => void
  onToggle: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      background: '#0d1117', border: `1px solid ${active ? strategy.color + '30' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', cursor: 'pointer',
        }}
        onClick={() => setOpen(!open)}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: active ? strategy.color : 'rgba(255,255,255,0.2)',
          boxShadow: active ? `0 0 8px ${strategy.color}` : 'none',
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#fff' : 'rgba(255,255,255,0.5)' }}>
            {strategy.label}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            {strategy.desc}
          </div>
        </div>
        {/* Weight badge */}
        <div style={{
          fontSize: 13, fontWeight: 800, color: strategy.color,
          fontFamily: 'monospace', minWidth: 40, textAlign: 'right',
        }}>
          {weight}%
        </div>
        {/* Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          {active
            ? <ToggleRight size={24} color={strategy.color} />
            : <ToggleLeft size={24} color="rgba(255,255,255,0.2)" />}
        </button>
        {open ? <ChevronUp size={14} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.3)" />}
      </div>

      {open && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Confluence og&apos;irligi</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: strategy.color, fontFamily: 'monospace' }}>{weight}%</span>
            </div>
            <input
              type="range" min={0} max={50} step={1} value={weight}
              onChange={e => onWeightChange(Number(e.target.value))}
              disabled={!active}
              style={{ width: '100%', accentColor: strategy.color }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>0%</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>50%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminAIPage() {
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(STRATEGIES.map(s => [s.key, s.defaultWeight]))
  )
  const [actives, setActives] = useState<Record<string, boolean>>(
    Object.fromEntries(STRATEGIES.map(s => [s.key, true]))
  )
  const [primaryModel, setPrimaryModel] = useState('gpt-4o-mini')
  const [saved, setSaved] = useState(false)
  const [params, setParams] = useState<AiParams>(DEFAULT_PARAMS)
  const [modelStats, setModelStats] = useState<ModelStat[]>([])
  const [todayCalls, setTodayCalls] = useState<number>(0)
  const [todayTokens, setTodayTokens] = useState<number>(0)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [loadingStats, setLoadingStats] = useState(false)
  const [activeTab, setActiveTab] = useState<'strategies' | 'params' | 'stats' | 'training' | 'errors'>('strategies')
  const [instructions, setInstructions] = useState<{ id: string; title: string; content: string; active: boolean; createdAt: string }[]>([])
  const [newInstruction, setNewInstruction] = useState({ title: '', content: '' })
  const [savingInst, setSavingInst] = useState(false)
  const [errorLogs, setErrorLogs] = useState<{ id: string; model: string; error: string; prompt?: string; createdAt: string }[]>([])
  const [loadingErrors, setLoadingErrors] = useState(false)

  // Firestore dan AI sozlamalarni yuklash (mount da bir marta)
  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then((d: { settings?: {
        aiParams?: Partial<AiParams>
        strategyWeights?: Record<string, number>
        strategyActives?: Record<string, boolean>
        primaryAiModel?: string
      } | null }) => {
        if (!d.settings) return
        if (d.settings.aiParams)         setParams(p => ({ ...p, ...d.settings!.aiParams }))
        if (d.settings.strategyWeights)  setWeights(d.settings.strategyWeights)
        if (d.settings.strategyActives)  setActives(d.settings.strategyActives)
        if (d.settings.primaryAiModel)   setPrimaryModel(d.settings.primaryAiModel)
      })
      .catch(() => { /* yuklanmasa default qiymatlar qoladi */ })
  }, [])

  const fetchStats = useCallback(async (p: string) => {
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/admin/ai-stats?period=${p}`)
      const d = await res.json() as { stats?: ModelStat[]; todayCalls?: number; todayTokens?: number }
      setModelStats(d.stats ?? [])
      setTodayCalls(d.todayCalls ?? 0)
      setTodayTokens(d.todayTokens ?? 0)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => { fetchStats(period) }, [period, fetchStats])

  const fetchInstructions = async () => {
    try {
      const r = await fetch('/api/admin/ai-training')
      const d = await r.json()
      setInstructions(d.instructions ?? [])
    } catch { /* ignore */ }
  }

  const saveInstruction = async () => {
    if (!newInstruction.title || !newInstruction.content) return
    setSavingInst(true)
    try {
      await fetch('/api/admin/ai-training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newInstruction) })
      setNewInstruction({ title: '', content: '' })
      fetchInstructions()
    } finally { setSavingInst(false) }
  }

  const deleteInstruction = async (id: string) => {
    await fetch(`/api/admin/ai-training?id=${id}`, { method: 'DELETE' })
    fetchInstructions()
  }

  const toggleInstruction = async (id: string, active: boolean) => {
    await fetch('/api/admin/ai-training', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active }) })
    fetchInstructions()
  }

  const fetchErrors = async () => {
    setLoadingErrors(true)
    try {
      const r = await fetch('/api/admin/ai-errors')
      const d = await r.json()
      setErrorLogs(d.errors ?? [])
    } finally { setLoadingErrors(false) }
  }

  useEffect(() => {
    if (activeTab === 'training') fetchInstructions()
    if (activeTab === 'errors') fetchErrors()
  }, [activeTab])

  const total = STRATEGIES.reduce((acc, s) => acc + (actives[s.key] ? weights[s.key] : 0), 0)

  const handleSave = async () => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiParams: params,
        strategyWeights: weights,
        strategyActives: actives,
        primaryAiModel: primaryModel,
      }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const resetWeights = () => {
    setWeights(Object.fromEntries(STRATEGIES.map(s => [s.key, s.defaultWeight])))
    setActives(Object.fromEntries(STRATEGIES.map(s => [s.key, true])))
  }

  return (
    <div className="admin-page-wrap">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>AI & Strategiyalar</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
            FATH AI modelini va confluence og&apos;irliklarini boshqarish
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={resetWeights}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13,
            }}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: saved ? 'rgba(0,212,170,0.15)' : 'rgba(91,139,255,0.15)',
              border: saved ? '1px solid rgba(0,212,170,0.4)' : '1px solid rgba(91,139,255,0.4)',
              color: saved ? '#00D4AA' : '#5B8BFF', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <Zap size={14} />
            {saved ? 'Saqlandi вњ“' : 'Saqlash'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs-wrap">
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 4, width: 'fit-content', minWidth: 'max-content' }}>
        {[
          { id: 'strategies', label: '⚗️ Strategiyalar',   icon: <Brain size={13} /> },
          { id: 'params',     label: '🎛️ AI Parametrlar', icon: <Sliders size={13} /> },
          { id: 'stats',      label: '📊 Statistika',       icon: <BarChart2 size={13} /> },
          { id: 'training',   label: '🎓 Training Console', icon: <Terminal size={13} /> },
          { id: 'errors',     label: '⚠️ Xatolar Logi',     icon: <AlertCircle size={13} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              padding: '8px 16px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: activeTab === tab.id ? 'rgba(91,139,255,0.15)' : 'transparent',
              border: activeTab === tab.id ? '1px solid rgba(91,139,255,0.35)' : '1px solid transparent',
              color: activeTab === tab.id ? '#5B8BFF' : 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      </div>

      {/* ─── TAB: Strategiyalar ─── */}
      {activeTab === 'strategies' && (
        <div className="g-sidebar">
          {/* Left вЂ” Strategiyalar */}
          <div>
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 8,
              background: Math.abs(total - 100) < 2 ? 'rgba(0,212,170,0.08)' : 'rgba(245,183,49,0.08)',
              border: `1px solid ${Math.abs(total - 100) < 2 ? 'rgba(0,212,170,0.25)' : 'rgba(245,183,49,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Jami og&apos;irlik:</span>
              <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: Math.abs(total - 100) < 2 ? '#00D4AA' : '#F5B731' }}>
                {total}% {Math.abs(total - 100) < 2 ? 'вњ“' : 'в‰  100%'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STRATEGIES.map(s => (
                <StrategyCard
                  key={s.key}
                  strategy={s}
                  weight={weights[s.key]}
                  active={actives[s.key]}
                  onWeightChange={v => setWeights(prev => ({ ...prev, [s.key]: v }))}
                  onToggle={() => setActives(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                />
              ))}
            </div>
          </div>

          {/* Right вЂ” Model tanlash */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                Birlamchi AI Modeli
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPrimaryModel(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      background: primaryModel === m.id ? `${m.color}12` : 'rgba(255,255,255,0.02)',
                      border: primaryModel === m.id ? `1px solid ${m.color}50` : '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{m.desc}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: m.color, background: `${m.color}18`, borderRadius: 4, padding: '2px 6px' }}>
                      {m.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Today quick stats */}
            <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>AI Holati (Bugun)</div>
              {[
                { label: 'GPT-4o Mini', value: 'Ulangan', color: '#00D4AA' },
                { label: 'Gemini 2.0 Flash', value: 'Ulangan', color: '#00D4AA' },
                { label: "Bugungi so'rovlar", value: todayCalls > 0 ? String(todayCalls) : 'вЂ”', color: '#5B8BFF' },
                { label: "Token sarfi (bugun)", value: todayTokens > 0 ? todayTokens.toLocaleString() : 'вЂ”', color: '#F5B731' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* в”Ђв”Ђ TAB: AI Parametrlar в”Ђв”Ђ */}
      {activeTab === 'params' && (
        <div className="g-2col">
          {/* LLM Params */}
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>LLM Parametrlar</div>
            {[
              { label: 'Temperature', key: 'temperature' as keyof AiParams, min: 0, max: 2, step: 0.05, color: '#5B8BFF', fmt: (v: number) => v.toFixed(2) },
              { label: 'Max Tokens', key: 'maxTokens' as keyof AiParams, min: 500, max: 8000, step: 100, color: '#9D6FFF', fmt: (v: number) => v.toLocaleString() },
              { label: 'Top P', key: 'topP' as keyof AiParams, min: 0, max: 1, step: 0.05, color: '#00D4AA', fmt: (v: number) => v.toFixed(2) },
            ].map(p => (
              <div key={p.key} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{p.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: p.color, fontFamily: 'monospace' }}>
                    {p.fmt(params[p.key] as number)}
                  </span>
                </div>
                <input
                  type="range" min={p.min} max={p.max} step={p.step}
                  value={params[p.key] as number}
                  onChange={e => setParams(prev => ({ ...prev, [p.key]: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: p.color }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{p.min}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{p.max}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Signal Thresholds */}
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>Signal Chegaralari</div>
            {[
              { label: 'Minimum Confluence', key: 'minConfluence' as keyof AiParams, min: 20, max: 90, step: 5, color: '#5B8BFF' },
              { label: 'Kuchli Signal (Strong)', key: 'strongThreshold' as keyof AiParams, min: 50, max: 95, step: 5, color: '#00D4AA' },
              { label: 'Conflict Tolerance', key: 'conflictTol' as keyof AiParams, min: 5, max: 50, step: 5, color: '#F5B731' },
            ].map(t => (
              <div key={t.key} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.color, fontFamily: 'monospace' }}>{params[t.key]}%</span>
                </div>
                <input
                  type="range" min={t.min} max={t.max} step={t.step}
                  value={params[t.key] as number}
                  onChange={e => setParams(prev => ({ ...prev, [t.key]: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: t.color }}
                />
              </div>
            ))}

            {/* Texnik vs Fundamental */}
            <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Texnik vs Fundamental</span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                  <span style={{ color: '#5B8BFF' }}>{params.techVsFundamental}%</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}> / </span>
                  <span style={{ color: '#00D4AA' }}>{100 - params.techVsFundamental}%</span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#5B8BFF', width: 55 }}>Texnik</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${params.techVsFundamental}%`, background: 'linear-gradient(to right, #5B8BFF, #00D4AA)', borderRadius: 3, transition: 'width 0.15s' }} />
                </div>
                <span style={{ fontSize: 10, color: '#00D4AA', width: 75, textAlign: 'right' }}>Fundamental</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={params.techVsFundamental}
                onChange={e => setParams(prev => ({ ...prev, techVsFundamental: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: '#5B8BFF' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* в”Ђв”Ђ TAB: Statistika в”Ђв”Ђ */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Period selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 3 }}>
              {(['today', 'week', 'month'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: period === p ? 'rgba(91,139,255,0.15)' : 'transparent',
                  border: period === p ? '1px solid rgba(91,139,255,0.35)' : '1px solid transparent',
                  color: period === p ? '#5B8BFF' : 'rgba(255,255,255,0.4)',
                }}>
                  {p === 'today' ? 'Bugun' : p === 'week' ? '7 kun' : '30 kun'}
                </button>
              ))}
            </div>
            <button onClick={() => fetchStats(period)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              <RefreshCw size={12} style={{ animation: loadingStats ? 'spin 1s linear infinite' : 'none' }} /> Yangilash
            </button>
          </div>

          {/* Summary cards */}
          <div className="g-3col">
            {[
              { label: "So'rovlar", value: todayCalls || modelStats.reduce((a, m) => a + m.calls, 0), color: '#5B8BFF', suffix: '' },
              { label: 'Token sarfi', value: (todayTokens || modelStats.reduce((a, m) => a + m.tokens, 0)).toLocaleString(), color: '#F5B731', suffix: '' },
              { label: 'Avg muvaffaqiyat', value: modelStats.length > 0 ? Math.round(modelStats.reduce((a, m) => a + m.successRate, 0) / modelStats.length) : 0, color: '#00D4AA', suffix: '%' },
            ].map(card => (
              <div key={card.label} style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: card.color, fontFamily: 'monospace' }}>{card.value}{card.suffix}</div>
              </div>
            ))}
          </div>

          {/* GPT vs Gemini comparison */}
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Model Qiyoslov
            </div>
            {loadingStats ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Yuklanmoqda...</div>
            ) : modelStats.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                Hozircha ma&apos;lumot yo&apos;q вЂ” signal yaratilganda avtomatik to&apos;planadi
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {['Model', 'So\'rovlar', 'Tokenlar', 'Muvaffaqiyat %', 'Avg Kechikish'].map(h => (
                      <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modelStats.map(row => {
                    const color = row.model.includes('gemini') ? '#5B8BFF' : row.model.includes('gpt-4o-mini') ? '#10B981' : '#F5B731'
                    return (
                      <tr key={row.model} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{row.model}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: 13, color: '#fff', fontFamily: 'monospace' }}>{row.calls}</td>
                        <td style={{ padding: '12px 18px', fontSize: 13, color: '#F5B731', fontFamily: 'monospace' }}>{row.tokens.toLocaleString()}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${row.successRate}%`, background: row.successRate > 80 ? '#00D4AA' : row.successRate > 60 ? '#F5B731' : '#FF4D6A', borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: row.successRate > 80 ? '#00D4AA' : row.successRate > 60 ? '#F5B731' : '#FF4D6A' }}>{row.successRate}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{row.avgLatency}ms</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Training Console ── */}
      {activeTab === 'training' && (
        <div className="g-2col">
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Yangi Ko&apos;rsatma Qo&apos;shish</div>
            <input
              value={newInstruction.title}
              onChange={e => setNewInstruction(v => ({ ...v, title: e.target.value }))}
              placeholder="Ko'rsatma sarlavhasi"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }}
            />
            <textarea
              value={newInstruction.content}
              onChange={e => setNewInstruction(v => ({ ...v, content: e.target.value }))}
              placeholder="AI ga ko'rsatma yozing..."
              rows={8}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
            <button
              onClick={saveInstruction} disabled={savingInst || !newInstruction.title || !newInstruction.content}
              style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: 'rgba(91,139,255,0.12)', border: '1px solid rgba(91,139,255,0.35)', color: '#5B8BFF', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              <Send size={13} /> {savingInst ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </div>
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Mavjud Ko&apos;rsatmalar</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{instructions.length} ta</span>
            </div>
            {instructions.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Hozircha ko&apos;rsatma yo&apos;q</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {instructions.map(inst => (
                <div key={inst.id} style={{ padding: 12, borderRadius: 9, background: inst.active ? 'rgba(91,139,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${inst.active ? 'rgba(91,139,255,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: inst.active ? '#fff' : 'rgba(255,255,255,0.4)' }}>{inst.title}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => toggleInstruction(inst.id, !inst.active)} style={{ cursor: 'pointer', background: 'none', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, color: inst.active ? '#00D4AA' : 'rgba(255,255,255,0.3)', border: `1px solid ${inst.active ? 'rgba(0,212,170,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                        {inst.active ? 'Aktiv' : 'Nofaol'}
                      </button>
                      <button onClick={() => deleteInstruction(inst.id)} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#FF4D6A', padding: '4px' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>{inst.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Xatolar Logi ── */}
      {activeTab === 'errors' && (
        <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>AI Xatolar Logi</span>
            <button onClick={fetchErrors} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 11 }}>
              <RefreshCw size={11} style={{ animation: loadingErrors ? 'spin 1s linear infinite' : 'none' }} /> Yangilash
            </button>
          </div>
          {errorLogs.length === 0 && !loadingErrors && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              <AlertCircle size={32} color="rgba(255,255,255,0.06)" style={{ display: 'block', margin: '0 auto 10px' }} />
              AI xatolari topilmadi
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {errorLogs.map(err => (
              <div key={err.id} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,77,106,0.04)', border: '1px solid rgba(255,77,106,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#FF4D6A', background: 'rgba(255,77,106,0.1)', padding: '2px 8px', borderRadius: 5 }}>{err.model ?? 'unknown'}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{err.createdAt ? new Date(err.createdAt).toLocaleString() : ''}</span>
                </div>
                <div style={{ fontSize: 12, color: '#FF6B6B', fontFamily: 'monospace' }}>{err.error}</div>
                {err.prompt && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>Prompt ko&apos;rish</summary>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginTop: 4, maxHeight: 120, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6 }}>{err.prompt}</div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

