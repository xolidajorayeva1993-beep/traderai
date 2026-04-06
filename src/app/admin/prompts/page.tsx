'use client'
// ============================================================
// /admin/prompts — AI Prompt boshqaruv sahifasi
// Admin Firestore /prompts/ kolleksiyasini CRUD bilan boshqaradi
// ============================================================

import { useEffect, useState, useCallback } from 'react'

interface PromptDoc {
  id: string
  name: string
  description: string
  content: string
  model: string
  temperature: number
  maxTokens: number
  enabled: boolean
  version: number
  lastUpdated: string
  history: Array<{ version: number; content: string; editedAt: string; note: string }>
}

const MODEL_OPTIONS = ['gpt-4o-mini', 'gpt-4o', 'gemini-2.0-flash', 'gemini-1.5-pro']

export default function AdminPromptsPage() {
  const [prompts, setPrompts]         = useState<PromptDoc[]>([])
  const [selected, setSelected]       = useState<PromptDoc | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editNote, setEditNote]       = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [message, setMessage]         = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [isCreating, setIsCreating]   = useState(false)
  const [newName, setNewName]         = useState('')
  const [newDesc, setNewDesc]         = useState('')
  const [initLoading, setInitLoading] = useState(false)

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true)
    try {
      const res  = await fetch('/api/admin/prompts')
      const data = await res.json() as { prompts?: PromptDoc[] }
      setPrompts(data.prompts ?? [])
    } catch {
      setMessage('Yuklab bo\'lmadi')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPrompts() }, [fetchPrompts])

  function selectPrompt(p: PromptDoc) {
    setSelected(p)
    setEditContent(p.content)
    setEditNote('')
    setShowHistory(false)
  }

  async function savePrompt() {
    if (!selected) return
    setIsLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, content: editContent, note: editNote }),
      })
      const data = await res.json() as PromptDoc & { error?: string }
      if (data.error) { setMessage('Xato: ' + data.error); return }
      setMessage('✅ Saqlandi (v' + data.version + ')')
      await fetchPrompts()
      setSelected({ ...selected, content: editContent, version: data.version })
    } catch {
      setMessage('Xato yuz berdi')
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleEnabled(p: PromptDoc) {
    await fetch('/api/admin/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, enabled: !p.enabled }),
    })
    await fetchPrompts()
  }

  async function createPrompt() {
    if (!newName.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          content: `# ${newName} prompt\n\nBu yerga prompt matnini kiriting...`,
          model: 'gpt-4o-mini',
        }),
      })
      const data = await res.json() as { error?: string }
      if (data.error) { setMessage('Xato: ' + data.error); return }
      setIsCreating(false)
      setNewName('')
      setNewDesc('')
      await fetchPrompts()
    } finally {
      setIsLoading(false)
    }
  }

  const hasSignalAnalysis = prompts.some(p => p.name === 'signal_analysis')

  async function initStrategy() {
    if (hasSignalAnalysis) {
      const p = prompts.find(q => q.name === 'signal_analysis')
      if (p) selectPrompt(p)
      return
    }
    setInitLoading(true)
    const template = `Sen FATH AI — professional AI trading yordamchisi.

STRATEGIYA: Malayziya SNR (Supply & Demand) strategiyasi

Qoidalar:
- Hech qachon "OpenAI", "GPT", "ChatGPT", "Gemini" dema. O'zing nomingni so'rashsa: "Men FATH AI".
- Faqat Forex va Kripto bozor haqida gapir.
- Asosiy tahlil usuli: SNR (Support & Resistance) darajalar va narx aksiyasi.
- Trend aniqlash: yuqori TF (H4/D1) orqali asosiy trend, past TF (H1/M15) orqali kirish.
- Indikatorlar: RSI (70/30 darajalari), MACD (crossover), EMA 20/50/200.
- Risk management: 1:2 minimal R:R, max 1-2% risk per trade.
- Javoblar O'zbek tilida (foydalanuvchi inglizcha so'rasa, inglizcha javob ber).
- MAJBURIY: har bir javobda mavzuga mos emoji ishlatilsin.

SIGNAL FORMATI (signal berganda DOIM shu formatda yoz):
🎯 SIGNAL
ENTRY: [narx]
SL: [stop loss narx]
TP1: [narx]
TP2: [narx]
TP3: [narx]
R:R: [nisbat, masalan 2.5]

Bu ta'limiy maqsadda. Haqiqiy moliyaviy maslahat emas.`
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'signal_analysis',
          description: 'AI Chat uchun asosiy tahlil strategiyasi',
          content: template,
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 1200,
        }),
      })
      const data = await res.json() as { error?: string }
      if (data.error) { setMessage('Xato: ' + data.error); return }
      setMessage('✅ signal_analysis strategiyasi yaratildi!')
      await fetchPrompts()
    } catch {
      setMessage('Xato yuz berdi')
    } finally {
      setInitLoading(false)
    }
  }

  async function deletePrompt(id: string) {
    if (!confirm('Promptni o\'chirasizmi?')) return
    await fetch(`/api/admin/prompts?id=${id}`, { method: 'DELETE' })
    if (selected?.id === id) setSelected(null)
    await fetchPrompts()
  }

  return (
    <div className="prompts-layout flex h-full gap-0">
      {/* Left sidebar — prompt list */}
      <aside className="prompts-sidebar w-64 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-white">AI Promptlar</h2>
            <button
              onClick={() => setIsCreating(true)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
            >+ Yangi</button>
          </div>
          <button
            onClick={initStrategy}
            disabled={initLoading}
            className={`w-full text-xs px-2 py-1.5 rounded font-semibold transition ${
              hasSignalAnalysis
                ? 'bg-green-900/40 text-green-400 border border-green-700 hover:bg-green-800/40'
                : 'bg-yellow-600 hover:bg-yellow-500 text-white animate-pulse'
            }`}
          >
            {hasSignalAnalysis ? '✅ Asosiy strategiya mavjud' : '⚡ Asosiy strategiya yaratish'}
          </button>
        </div>

        {isCreating && (
          <div className="p-3 border-b border-gray-700 space-y-2">
            <input
              className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1"
              placeholder="prompt_nomi"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1"
              placeholder="Tavsif (ixtiyoriy)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={createPrompt} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1 rounded">Yaratish</button>
              <button onClick={() => setIsCreating(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white text-xs py-1 rounded">Bekor</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && prompts.length === 0 && (
            <p className="text-gray-400 text-xs p-4">Yuklanmoqda...</p>
          )}
          {prompts.map(p => (
            <button
              key={p.id}
              onClick={() => selectPrompt(p)}
              className={`w-full text-left px-4 py-3 border-b border-gray-700/50 hover:bg-gray-700/50 transition ${
                selected?.id === p.id ? 'bg-gray-700 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-white truncate">{p.name}</span>
                <div className="flex items-center gap-1">
                  {p.name === 'signal_analysis' && (
                    <span className="text-xs bg-yellow-600/30 text-yellow-400 px-1 rounded border border-yellow-700/50">AI</span>
                  )}
                  <span className={`text-xs px-1 rounded ${p.enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {p.enabled ? '●' : '○'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 truncate">{p.description || p.model}</span>
                <span className="text-xs text-gray-500">v{p.version}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main editor area */}
      <main className="prompts-main flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold font-mono">{selected.name}</h2>
                <p className="text-gray-400 text-xs">{selected.description} · v{selected.version} · {selected.lastUpdated?.slice(0, 10)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleEnabled(selected)}
                  className={`text-xs px-3 py-1 rounded ${selected.enabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
                >
                  {selected.enabled ? 'Yoqilgan' : 'O\'chirilgan'}
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded"
                >
                  Tarix ({selected.history?.length ?? 0})
                </button>
                <button
                  onClick={() => deletePrompt(selected.id)}
                  className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded"
                >O'chirish</button>
              </div>
            </div>

            {showHistory ? (
              /* History panel */
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <h3 className="text-sm text-white font-semibold">Tarix</h3>
                {(selected.history ?? []).length === 0 && (
                  <p className="text-gray-400 text-sm">Hech qanday o&apos;zgarish yo&apos;q</p>
                )}
                {[...(selected.history ?? [])].reverse().map((h, i) => (
                  <div key={i} className="bg-gray-800 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-blue-400">v{h.version}</span>
                      <span className="text-xs text-gray-400">{h.editedAt?.slice(0, 16)}</span>
                    </div>
                    <p className="text-xs text-gray-300 italic mb-2">{h.note}</p>
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap line-clamp-6">{h.content}</pre>
                    <button
                      onClick={() => { setEditContent(h.content); setShowHistory(false) }}
                      className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                    >Bu versiyani tiklash</button>
                  </div>
                ))}
              </div>
            ) : (
              /* Editor */
              <div className="flex-1 flex flex-col p-4 gap-3">
                <div className="flex gap-4 text-sm">
                  <div className="flex-1">
                    <label className="text-gray-400 text-xs block mb-1">Model</label>
                    <select
                      className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
                      defaultValue={selected.model}
                      onChange={async e => {
                        await fetch('/api/admin/prompts', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selected.id, model: e.target.value }),
                        })
                        await fetchPrompts()
                      }}
                    >
                      {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Temperature</label>
                    <input
                      type="number" min="0" max="1" step="0.1"
                      className="w-20 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
                      defaultValue={selected.temperature}
                      onBlur={async e => {
                        await fetch('/api/admin/prompts', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selected.id, temperature: parseFloat(e.target.value) }),
                        })
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Max Tokens</label>
                    <input
                      type="number" min="100" max="4000" step="100"
                      className="w-24 bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
                      defaultValue={selected.maxTokens}
                      onBlur={async e => {
                        await fetch('/api/admin/prompts', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selected.id, maxTokens: parseInt(e.target.value) }),
                        })
                      }}
                    />
                  </div>
                </div>

                <textarea
                  className="flex-1 bg-gray-900 text-green-300 text-xs font-mono rounded p-3 border border-gray-700 resize-none focus:outline-none focus:border-blue-500"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  spellCheck={false}
                  placeholder="Prompt matnini shu yerga kiriting..."
                />

                {/* enabled=false ogohlantirish */}
                {selected && !selected.enabled && (
                  <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 rounded px-4 py-3 text-sm text-red-300">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-semibold">Bu prompt O'CHIRILgan!</p>
                      <p className="text-xs text-red-400 mt-0.5">AI hozir bu promptni emas, ichki default promptni ishlatmoqda. Yoqish uchun yuqoridagi <b>&quot;Yoqilgan / O&apos;chirilgan&quot;</b> tugmasini bosing.</p>
                    </div>
                    <button
                      onClick={() => toggleEnabled(selected)}
                      className="ml-auto bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap"
                    >Yoqish ✓</button>
                  </div>
                )}

                {/* signal_analysis emas bo'lsa ogohlantir */}
                {selected && selected.name !== 'signal_analysis' && selected.enabled && (
                  <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-2 text-xs text-yellow-300">
                    <span>ℹ️</span>
                    <p>Bu prompt AI chatda avtomatik ishlamaydi. Faqat <b>signal_analysis</b> nomli prompt AI tomonidan chatda qo&apos;llaniladi.</p>
                  </div>
                )}

                <div className="flex gap-3 items-center">
                  <input
                    className="flex-1 bg-gray-700 text-white text-xs rounded px-3 py-2 border border-gray-600"
                    placeholder="O'zgartirish izohi (ixtiyoriy)"
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                  />
                  <button
                    onClick={savePrompt}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-6 py-2 rounded"
                  >
                    {isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>

                {message && (
                  <p className={`text-xs ${message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                    {message}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400 max-w-sm">
              <p className="text-4xl mb-3">📝</p>
              <p>Chap paneldan prompt tanlang</p>
              <p className="text-xs mt-2">yoki yangi prompt yarating</p>
              <div className="mt-6 bg-gray-800 rounded-lg p-4 text-left border border-gray-700">
                <p className="text-yellow-400 text-xs font-semibold mb-2">⚡ AI Chat qanday ishlaydi?</p>
                <p className="text-xs text-gray-300">
                  <span className="text-yellow-300 font-mono">signal_analysis</span> nomli prompt
                  AI Chat da avtomatik ishlatiladi.
                  Strategiyani o&apos;zgartirish uchun shu promptni tahrirlang.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
