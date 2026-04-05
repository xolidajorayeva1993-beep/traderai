'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, Crown, Check, X, Clock,
  RefreshCw, AlertCircle, Loader2, Zap,
} from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import { auth } from '@/lib/firebase/config';

//  Types 
interface FPlan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
  period: string;
  limits: {
    dailySignals?: number;
    aiChatLimit?: number;
    telegramSignal?: boolean;
    fundamentalAnalysis?: boolean;
    prioritySignal?: boolean;
    apiAccess?: boolean;
  };
  trialDays?: number;
}

interface SubRecord {
  id: string;
  planId: string;
  planName?: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  paidAt?: string;
  createdAt?: string;
}

const PAYMENT_METHODS = [
  { id: 'click', label: 'Click', logo: '', desc: "O'zbekiston kartasi" },
  { id: 'payme', label: 'Payme', logo: '', desc: "O'zbekiston kartasi" },
  { id: 'stripe', label: 'Stripe', logo: '', desc: 'Xalqaro karta' },
];

function daysUntil(ts: number) {
  return Math.max(0, Math.ceil((ts - Date.now()) / 86_400_000));
}

function formatPeriod(period: string) {
  if (period === 'monthly') return '/oy';
  if (period === 'yearly') return '/yil';
  return '';
}

function formatPrice(price: number, currency: string) {
  if (price === 0) return 'Bepul';
  if (currency === 'UZS') return `${price.toLocaleString()} so'm`;
  return `$${price}`;
}

export default function BillingPage() {
  const user = useAuth((s) => s.user);

  const [plans, setPlans]           = useState<FPlan[]>([]);
  const [subs, setSubs]             = useState<SubRecord[]>([]);
  const [usage, setUsage]           = useState<{
    aiChatUsed: number; monthlyLimit: number; remaining: number; daysLeft: number | null; expired: boolean; periodEnd: number;
  } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [paying, setPaying]         = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError]           = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState('click');

  const planExpiresAt = (user as unknown as { planExpiresAt?: number | string })?.planExpiresAt;
  const planExpireTs = planExpiresAt
    ? typeof planExpiresAt === 'number' ? planExpiresAt : new Date(planExpiresAt).getTime()
    : null;
  const planDaysLeft = planExpireTs ? daysUntil(planExpireTs) : null;
  const trialEndsAt = (user as unknown as { trialEndsAt?: number })?.trialEndsAt;
  const trialDaysLeft = trialEndsAt ? daysUntil(trialEndsAt) : 0;

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then((data: { plans?: FPlan[] }) => setPlans(data.plans ?? []))
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    fetch(`/api/profile/usage?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => setUsage(d))
      .catch(() => {});
  }, [user?.uid]);

  const currentPlanData = plans.find(p => p.name === (user?.plan ?? 'free'));
  const planColor = user?.plan === 'vip' ? '#F5B731' : user?.plan === 'pro' ? '#00D4AA' : '#6b7280';

  const loadSubs = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setLoading(false); return; }
      const res = await fetch('/api/payment/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { subscriptions?: SubRecord[] };
      setSubs(data.subscriptions ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [user?.uid]);

  useEffect(() => { loadSubs(); }, [loadSubs]);

  const handlePay = async () => {
    if (!selectedPlan || !user?.uid) return;
    setPaying(true); setError('');
    try {
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan, method: selectedMethod, uid: user.uid }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "To'lov boshlashda xatolik");
    } catch { setError("To'lov boshlashda xatolik"); }
    finally { setPaying(false); }
  };

  const handleCancel = async () => {
    if (!confirm("Obunani bekor qilishni tasdiqlaysizmi? Joriy period oxirigacha foydalanishingiz mumkin.")) return;
    setCancelling(true); setError('');
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user?.uid }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) loadSubs();
      else setError(data.error ?? 'Bekor qilishda xatolik');
    } catch { setError('Bekor qilishda xatolik'); }
    finally { setCancelling(false); }
  };

  if (!user) return null;

  const limits = currentPlanData?.limits ?? {};
  const dailySignals = limits.dailySignals ?? (user.plan === 'free' ? 2 : 999);
  const aiChatLimit = limits.aiChatLimit ?? (user.plan === 'free' ? 5 : 999);

  const capabilityRows = [
    { label: 'Kunlik signal', value: dailySignals >= 999 ? 'Cheksiz' : `${dailySignals} ta`, ok: true },
    { label: 'AI Chat', value: aiChatLimit >= 999 ? 'Cheksiz' : `${aiChatLimit} ta/kun`, ok: true },
    { label: 'Telegram bildirish', value: limits.telegramSignal ? 'Ha' : "Yo'q", ok: !!limits.telegramSignal },
    { label: 'Fundamental tahlil', value: limits.fundamentalAnalysis ? 'Ha' : "Yo'q", ok: !!limits.fundamentalAnalysis },
    { label: 'Priority signal', value: limits.prioritySignal ? 'Ha' : "Yo'q", ok: !!limits.prioritySignal },
    { label: 'API kirish', value: limits.apiAccess ? 'Ha' : "Yo'q", ok: !!limits.apiAccess },
  ];

  const upgradePlans = plans.filter(p => p.name !== (user.plan ?? 'free'));

  return (
    <div style={{ padding: '20px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `${planColor}18`, border: `1px solid ${planColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CreditCard size={22} color={planColor} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Billing va Obuna</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Obuna holati, to&apos;lovlar va reja yangilash</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.25)', color: '#FF4D6A', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#0d1117', border: `1px solid ${planColor}30`, borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>JORIY REJA</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${planColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={24} color={planColor} />
            </div>
            <div>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {currentPlanData?.displayName ?? user.plan ?? 'Free'}
              </p>
              <p style={{ fontSize: 13, color: planColor, fontWeight: 600, marginTop: 3 }}>
                {currentPlanData
                  ? currentPlanData.price === 0
                    ? 'Bepul reja'
                    : `${formatPrice(currentPlanData.price, currentPlanData.currency)}${formatPeriod(currentPlanData.period)}`
                  : 'Bepul reja'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Holat</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#00D4AA', fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 6px #00D4AA', display: 'inline-block' }} />
              Faol
            </span>
          </div>

          {trialDaysLeft > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'rgba(245,183,49,0.08)', border: '1px solid rgba(245,183,49,0.2)', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#F5B731" />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Trial tugaydi</span>
              </div>
              <span style={{ fontSize: 13, color: '#F5B731', fontWeight: 700 }}>{trialDaysLeft} kun qoldi</span>
            </div>
          )}

          {planDaysLeft !== null && user.plan !== 'free' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Muddati tugaydi</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: planDaysLeft < 7 ? '#FF4D6A' : 'rgba(255,255,255,0.7)' }}>
                {planDaysLeft} kun
              </span>
            </div>
          )}

          {/* Usage bars */}
          {usage && (
            <div style={{ marginTop: 8, marginBottom: 10 }}>
              {/* AI Chat usage */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>AI Chat (oylik)</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: usage.remaining === 0 ? '#FF4D6A' : planColor }}>
                    {usage.aiChatUsed} / {usage.monthlyLimit}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 5, width: `${Math.min(100, Math.round(usage.aiChatUsed / usage.monthlyLimit * 100))}%`, background: usage.remaining === 0 ? '#FF4D6A' : usage.aiChatUsed / usage.monthlyLimit > 0.75 ? '#F5B731' : planColor }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{usage.remaining} ta qoldi</span>
                  {usage.daysLeft !== null && <span style={{ fontSize: 11, color: usage.daysLeft < 5 ? '#FF4D6A' : 'rgba(255,255,255,0.3)' }}>{usage.daysLeft} kun qoldi</span>}
                </div>
              </div>
            </div>
          )}

          {user.plan !== 'free' && (
            <button onClick={handleCancel} disabled={cancelling} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10, cursor: 'pointer', background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', color: '#FF4D6A', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {cancelling ? <Loader2 size={14} className="spin" /> : <X size={14} />}
              Obunani bekor qilish
            </button>
          )}
        </div>

        <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16 }}>REJA IMKONIYATLARI</p>
          {plansLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              <Loader2 size={14} className="spin" /> Yuklanmoqda...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {capabilityRows.map(({ label, value, ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {ok ? <Check size={14} color="#00D4AA" /> : <X size={14} color="rgba(255,255,255,0.2)" />}
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: ok ? '#fff' : 'rgba(255,255,255,0.3)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {upgradePlans.length > 0 && (
        <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Rejani yangilash</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Ko&apos;proq imkoniyatlarga ega bo&apos;ling</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
            {upgradePlans.map(plan => {
              const col = plan.name === 'vip' ? '#F5B731' : '#00D4AA';
              const isSelected = selectedPlan === plan.name;
              return (
                <button key={plan.id} onClick={() => setSelectedPlan(isSelected ? null : plan.name)} style={{ padding: 18, borderRadius: 14, cursor: 'pointer', textAlign: 'left', background: isSelected ? `${col}12` : 'rgba(255,255,255,0.02)', border: `2px solid ${isSelected ? col : 'rgba(255,255,255,0.08)'}`, position: 'relative' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: col, marginBottom: 4 }}>{plan.displayName}</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 12 }}>
                    {formatPrice(plan.price, plan.currency)}
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>{formatPeriod(plan.period)}</span>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(limits.dailySignals ?? 0) >= 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Check size={11} color={col} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                          {(plan.limits.dailySignals ?? 0) >= 999 ? 'Cheksiz signallar' : `Kuniga ${plan.limits.dailySignals ?? 0} ta signal`}
                        </span>
                      </div>
                    )}
                    {(plan.limits.aiChatLimit ?? 0) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Check size={11} color={col} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                          {(plan.limits.aiChatLimit ?? 0) >= 999 ? 'AI Chat cheksiz' : `AI Chat ${plan.limits.aiChatLimit} ta/kun`}
                        </span>
                      </div>
                    )}
                    {plan.limits.telegramSignal && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={11} color={col} /><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Telegram bildirish</span></div>}
                    {plan.limits.prioritySignal && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={11} color={col} /><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Priority signal</span></div>}
                    {plan.limits.apiAccess && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={11} color={col} /><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>API kirish</span></div>}
                  </div>
                  {isSelected && <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#000" /></div>}
                  {(plan.trialDays ?? 0) > 0 && <div style={{ marginTop: 10, fontSize: 11, color: '#00D4AA' }}> {plan.trialDays} kun bepul sinov</div>}
                </button>
              );
            })}
          </div>

          {selectedPlan && (
            <>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>To&apos;lov usulini tanlang</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {PAYMENT_METHODS.map(m => (
                  <button key={m.id} onClick={() => setSelectedMethod(m.id)} style={{ padding: '10px 18px', borderRadius: 10, cursor: 'pointer', background: selectedMethod === m.id ? 'rgba(91,139,255,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedMethod === m.id ? '#5B8BFF' : 'rgba(255,255,255,0.1)'}`, color: selectedMethod === m.id ? '#5B8BFF' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{m.logo}</span> {m.label} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{m.desc}</span>
                  </button>
                ))}
              </div>
              <button onClick={handlePay} disabled={paying} style={{ padding: '12px 28px', borderRadius: 12, cursor: paying ? 'not-allowed' : 'pointer', border: 'none', background: 'linear-gradient(135deg,#00D4AA,#5B8BFF)', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, opacity: paying ? 0.7 : 1 }}>
                {paying ? <><Loader2 size={16} className="spin" /> Yuklanmoqda...</> : <><Zap size={16} /> {upgradePlans.find(p => p.name === selectedPlan)?.displayName} rejasini sotib olish</>}
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>To&apos;lov tarixi</p>
          <button onClick={loadSubs} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
            <RefreshCw size={12} /> Yangilash
          </button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Loader2 size={16} className="spin" /> Yuklanmoqda...
          </div>
        ) : subs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.25)' }}>
            <CreditCard size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p style={{ fontSize: 13 }}>To&apos;lov tarixi mavjud emas</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subs.map(sub => {
              const mc = ({ click: '#00A8FF', payme: '#9D6FFF', stripe: '#635BFF' } as Record<string, string>)[sub.paymentMethod] ?? '#5B8BFF';
              const sc = ({ active: '#00D4AA', expired: '#FF4D6A', cancelled: '#F5B731', trial: '#5B8BFF' } as Record<string, string>)[sub.status] ?? '#6b7280';
              const date = sub.paidAt ?? sub.createdAt ?? '';
              const planLabel = plans.find(p => p.name === sub.planId)?.displayName ?? sub.planName ?? sub.planId;
              return (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${mc}14`, border: `1px solid ${mc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditCard size={16} color={mc} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{planLabel}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        {sub.paymentMethod.toUpperCase()}  {date ? new Date(date).toLocaleDateString('uz-UZ') : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                      {sub.currency === 'UZS' ? `${sub.amount.toLocaleString()} so'm` : `$${sub.amount}`}
                    </p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: `${sc}14`, padding: '2px 8px', borderRadius: 5 }}>{sub.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}
