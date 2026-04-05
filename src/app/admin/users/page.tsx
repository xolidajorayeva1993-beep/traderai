'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Users, Search, RefreshCw, Shield, User, Crown, Ban, CheckCircle, ExternalLink } from 'lucide-react'

interface AppUser {
  uid: string
  email: string
  displayName: string
  emailVerified: boolean
  disabled: boolean
  createdAt: number
  lastSignIn: number
  role: string
  plan: string
}

const ROLE_CONFIG = {
  admin:   { label: 'Admin',    color: '#F5B731', bg: 'rgba(245,183,49,0.12)',   icon: Crown  },
  premium: { label: 'Premium',  color: '#9D6FFF', bg: 'rgba(157,111,255,0.12)', icon: Shield },
  free:    { label: 'Free',     color: '#5B8BFF', bg: 'rgba(91,139,255,0.12)',  icon: User   },
  banned:  { label: 'Banned',   color: '#FF4D6A', bg: 'rgba(255,77,106,0.12)',  icon: Ban    },
}

function timeAgo(ts: number) {
  if (!ts) return '—'
  const d = Date.now() - ts
  if (d < 60000) return `${Math.floor(d / 1000)}s`
  if (d < 3600000) return `${Math.floor(d / 60000)}m`
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`
  return new Date(ts).toLocaleDateString()
}

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.free
  const Icon = c.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, color: c.color, borderRadius: 6,
      padding: '3px 9px', fontSize: 11, fontWeight: 700,
    }}>
      <Icon size={11} />
      {c.label}
    </span>
  )
}

function UserRow({ user, onUpdate, selected, onToggle }: {
  user: AppUser; onUpdate: () => void; selected: boolean; onToggle: () => void
}) {
  const [changing, setChanging] = useState(false)
  const [pickedRole, setPickedRole] = useState(user.role)
  const [open, setOpen] = useState(false)

  const applyRole = async (newRole: string) => {
    setChanging(true)
    setOpen(false)
    try {
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, role: newRole }),
      })
      setPickedRole(newRole)
      onUpdate()
    } finally {
      setChanging(false)
    }
  }

  const toggleDisabled = async () => {
    setChanging(true)
    try {
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, disabled: !user.disabled }),
      })
      onUpdate()
    } finally {
      setChanging(false)
    }
  }

  const initials = user.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase()

  const roleColor = ROLE_CONFIG[pickedRole as keyof typeof ROLE_CONFIG]?.color ?? '#5B8BFF'

  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: selected ? 'rgba(91,139,255,0.05)' : 'transparent' }}>
      <td style={{ padding: '12px 8px 12px 16px', width: 36 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          style={{ cursor: 'pointer', accentColor: '#5B8BFF' }}
        />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${roleColor}20`, fontSize: 13, fontWeight: 700, color: roleColor,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {user.displayName || '—'}
              {user.emailVerified && (
                <CheckCircle size={11} color="#00D4AA" style={{ marginLeft: 5, display: 'inline' }} />
              )}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{user.email}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 8px' }}>
        <RoleBadge role={pickedRole} />
      </td>
      <td style={{ padding: '12px 8px' }}>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: user.plan === 'premium' ? '#9D6FFF' : 'rgba(255,255,255,0.4)',
        }}>
          {user.plan}
        </span>
      </td>
      <td style={{ padding: '12px 8px', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
        {timeAgo(user.createdAt)}
      </td>
      <td style={{ padding: '12px 8px', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
        {timeAgo(user.lastSignIn)}
      </td>
      <td style={{ padding: '12px 8px' }}>
        <span style={{
          fontSize: 11, padding: '3px 8px',
          color: user.disabled ? '#FF4D6A' : '#00D4AA',
        }}>
          {user.disabled ? 'Bloklangan' : 'Aktiv'}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Role tanlash */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(!open)}
              disabled={changing}
              style={{
                background: 'rgba(91,139,255,0.1)', border: '1px solid rgba(91,139,255,0.25)',
                color: '#5B8BFF', borderRadius: 6, padding: '4px 10px',
                fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Rol ↓
            </button>
            {open && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
                background: '#161b2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, overflow: 'hidden', minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {(['free', 'premium', 'admin'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => applyRole(r)}
                    style={{
                      display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left',
                      background: pickedRole === r ? 'rgba(91,139,255,0.15)' : 'transparent',
                      border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bloklash */}
          <button
            onClick={toggleDisabled}
            disabled={changing}
            style={{
              background: user.disabled ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)',
              border: `1px solid ${user.disabled ? 'rgba(0,212,170,0.25)' : 'rgba(255,77,106,0.25)'}`,
              color: user.disabled ? '#00D4AA' : '#FF4D6A', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}
          >
            {user.disabled ? 'Blok olib tashlash' : 'Bloklash'}
          </button>

          {/* Detail */}
          <Link
            href={`/admin/users/${user.uid}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '4px 8px',
              fontSize: 11, textDecoration: 'none', fontWeight: 600,
            }}
          >
            <ExternalLink size={11} />
            Detail
          </Link>
        </div>
      </td>
    </tr>
  )
}

const BULK_ACTIONS = [
  { value: 'setRole',  label: 'Rol belgilash',  hasInput: true,  placeholder: 'free | premium | admin | banned' },
  { value: 'setPlan',  label: 'Tarif belgilash', hasInput: true,  placeholder: 'free | premium | pro' },
  { value: 'disable',  label: 'Bloklash',        hasInput: false, placeholder: '' },
  { value: 'enable',   label: 'Blokni ochish',   hasInput: false, placeholder: '' },
  { value: 'sendAlert',label: 'Xabar yuborish',  hasInput: true,  placeholder: 'Xabar matni...' },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState('setRole')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.users) setUsers(data.users)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleSelect = (uid: string) =>
    setSelectedUids(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid])

  const toggleAll = (ids: string[]) =>
    setSelectedUids(prev => prev.length === ids.length ? [] : ids)

  const executeBulk = async () => {
    if (!selectedUids.length) return
    const activeAction = BULK_ACTIONS.find(a => a.value === bulkAction)
    if (activeAction?.hasInput && !bulkValue.trim()) return
    setBulkLoading(true); setBulkMsg('')
    try {
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: selectedUids, action: bulkAction, value: bulkValue.trim() }),
      })
      const data = await res.json()
      setBulkMsg(`✓ ${data.successCount} muvaffaqiyatli, ${data.failCount} xato`)
      setSelectedUids([])
      setBulkValue('')
      load()
    } catch {
      setBulkMsg('Xatolik yuz berdi')
    } finally {
      setBulkLoading(false)
    }
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    const q = search.toLowerCase()
    return !q || u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
  })

  const counts = { total: users.length, admin: 0, premium: 0, free: 0, disabled: 0 }
  users.forEach(u => {
    if (u.role === 'admin') counts.admin++
    else if (u.role === 'premium') counts.premium++
    else counts.free++
    if (u.disabled) counts.disabled++
  })

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Foydalanuvchilar</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
            Jami {counts.total} foydalanuvchi
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(91,139,255,0.1)', border: '1px solid rgba(91,139,255,0.3)',
            color: '#5B8BFF', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13,
          }}
        >
          <RefreshCw size={14} />
          Yangilash
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Jami',    value: counts.total,    color: '#5B8BFF' },
          { label: 'Admin',   value: counts.admin,    color: '#F5B731' },
          { label: 'Premium', value: counts.premium,  color: '#9D6FFF' },
          { label: 'Free',    value: counts.free,     color: '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#0d1117', border: `1px solid ${s.color}25`,
            borderRadius: 12, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedUids.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          background: 'rgba(91,139,255,0.08)', border: '1px solid rgba(91,139,255,0.25)',
          borderRadius: 10, padding: '10px 16px',
        }}>
          <span style={{ fontSize: 12, color: '#5B8BFF', fontWeight: 700, minWidth: 80 }}>
            {selectedUids.length} tanlandi
          </span>
          <select
            value={bulkAction}
            onChange={e => { setBulkAction(e.target.value); setBulkValue(''); setBulkMsg('') }}
            style={{
              background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12,
            }}
          >
            {BULK_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          {BULK_ACTIONS.find(a => a.value === bulkAction)?.hasInput && (
            <input
              value={bulkValue}
              onChange={e => setBulkValue(e.target.value)}
              placeholder={BULK_ACTIONS.find(a => a.value === bulkAction)?.placeholder}
              style={{
                background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, minWidth: 180,
              }}
            />
          )}
          <button
            onClick={executeBulk}
            disabled={bulkLoading}
            style={{
              background: '#5B8BFF', border: 'none', color: '#fff',
              borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {bulkLoading ? '...' : 'Bajarish'}
          </button>
          <button
            onClick={() => { setSelectedUids([]); setBulkMsg('') }}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.4)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >
            Bekor
          </button>
          {bulkMsg && <span style={{ fontSize: 12, color: bulkMsg.startsWith('✓') ? '#00D4AA' : '#FF4D6A', marginLeft: 8 }}>{bulkMsg}</span>}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '6px 12px', flex: 1, maxWidth: 280,
        }}>
          <Search size={14} color="rgba(255,255,255,0.3)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Email yoki ism qidirish..."
            style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13, flex: 1 }}
          />
        </div>
        {(['all', 'free', 'premium', 'admin'] as const).map(f => (
          <button
            key={f}
            onClick={() => setRoleFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: roleFilter === f ? 'rgba(91,139,255,0.2)' : 'rgba(255,255,255,0.04)',
              border: roleFilter === f ? '1px solid rgba(91,139,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
              color: roleFilter === f ? '#5B8BFF' : 'rgba(255,255,255,0.5)',
            }}
          >
            {f === 'all' ? 'Barchasi' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Yuklanmoqda...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
            Foydalanuvchi topilmadi
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ padding: '10px 8px 10px 16px', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every(u => selectedUids.includes(u.uid))}
                    onChange={() => toggleAll(filtered.map(u => u.uid))}
                    style={{ cursor: 'pointer', accentColor: '#5B8BFF' }}
                  />
                </th>
                {['Foydalanuvchi', 'Rol', 'Tarif', "Ro'yxat", 'Oxirgi kirish', 'Holat', 'Harakat'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <UserRow
                  key={u.uid}
                  user={u}
                  onUpdate={load}
                  selected={selectedUids.includes(u.uid)}
                  onToggle={() => toggleSelect(u.uid)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
