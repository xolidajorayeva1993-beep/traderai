import Link from 'next/link';
import Image from 'next/image';
import {
  TrendingUp, Zap, Shield, Brain, BarChart2,
  ArrowRight, Star, CheckCircle, Activity,
  Bell, Target, ChevronRight, Clock, DollarSign, Users, TrendingDown,
} from 'lucide-react';
import { initAdmin } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

// --- Firestore plan types ---
interface FPlan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
  period: string;
  active?: boolean;
  limits: {
    dailySignals?: number;
    aiChatLimit?: number;
    telegramSignal?: boolean;
    fundamentalAnalysis?: boolean;
    multiTimeframe?: boolean;
    backtestAccess?: boolean;
    prioritySignal?: boolean;
    apiAccess?: boolean;
  };
  trialDays?: number;
  sortOrder?: number;
}

interface DisplayPlan {
  id: string;
  planName: string;
  name: string;
  price: string;
  period: string;
  color: string;
  desc: string;
  features: string[];
  missing: string[];
  cta: string;
  highlight: boolean;
}

const PLAN_COLORS: Record<string, string> = {
  free: '#5B8BFF', pro: '#00D4AA', premium: '#00D4AA', vip: '#F5B731', ultimate: '#F5B731',
};

function formatPrice(price: number, currency: string): string {
  if (price === 0) return '$0';
  if (currency === 'UZS') return `${price.toLocaleString()} so'm`;
  return `$${price}`;
}

function formatPeriod(period: string): string {
  if (period === 'monthly') return '/oy';
  if (period === 'yearly') return '/yil';
  return '';
}

function buildFeatures(limits: FPlan['limits']): string[] {
  const f: string[] = [];
  const ds = limits.dailySignals ?? 0;
  f.push(ds <= 0 || ds >= 999 ? 'Cheksiz signallar' : `Kuniga ${ds} ta signal`);
  const ac = limits.aiChatLimit ?? 0;
  f.push(ac <= 0 || ac >= 999 ? 'AI Chat cheksiz' : `AI Chat (${ac} ta/kun)`);
  if (limits.telegramSignal)      f.push('Telegram bildirish');
  if (limits.fundamentalAnalysis) f.push('Fundamental tahlil');
  if (limits.multiTimeframe)      f.push("Ko'p vaqt doirasi");
  if (limits.backtestAccess)      f.push('Backtest kirish');
  if (limits.prioritySignal)      f.push('Priority signal');
  if (limits.apiAccess)           f.push('API kirish');
  return f;
}

function buildMissing(limits: FPlan['limits']): string[] {
  const m: string[] = [];
  if (!limits.telegramSignal)      m.push('Telegram bildirish');
  if (!limits.fundamentalAnalysis) m.push('Fundamental tahlil');
  if (!limits.prioritySignal)      m.push('Priority signal');
  if (!limits.apiAccess)           m.push('API kirish');
  return m.slice(0, 3);
}

async function getActivePlans(): Promise<DisplayPlan[]> {
  try {
    initAdmin();
    const db = getFirestore();
    const snap = await db.collection('plans').orderBy('sortOrder').get();
    const plans = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as FPlan))
      .filter(p => p.active !== false);
    if (plans.length === 0) return [];
    return plans.map((p, i) => ({
      id: p.id,
      planName: p.name,
      name: p.displayName,
      price: formatPrice(p.price, p.currency),
      period: formatPeriod(p.period),
      color: PLAN_COLORS[p.name] ?? '#5B8BFF',
      desc: p.trialDays
        ? `${p.trialDays} kun bepul sinov bilan`
        : p.price === 0
          ? "Sinab ko'rish uchun. Hech narsa to'lamaysiz."
          : `${p.displayName} tarifi uchun.`,
      features: buildFeatures(p.limits ?? {}),
      missing: buildMissing(p.limits ?? {}),
      cta: p.price === 0 ? 'Bepul Boshlash' : `${p.displayName} Boshlash`,
      highlight: i === 1,
    }));
  } catch {
    return [];
  }
}

// --- Static data ---
const STATS = [
  { value: '89%', label: "Signal muvaffaqiyati", sub: "Oxirgi 90 kunlik haqiqiy natija" },
  { value: '2,800+', label: "Foydalanuvchi", sub: "O\'zbekiston va MDH dan" },
  { value: '28', label: "Valyuta & Kripto", sub: 'Barchasi real vaqtda kuzatiladi' },
  { value: '3 daq', label: "Signal yetkazish", sub: "Tahlildan Telegramingizgacha" },
];

const PAIN_POINTS = [
  {
    icon: Clock,
    title: "Grafik bilan soatlab o'tirasiizmi?",
    desc: "Ko'pchilik treyder kun bo'yi grafik qarash uchun vaqt sarflaydi. FATH AI bu ishni siz uchun avtomatik bajaradi — siz faqat signal kutasiz.",
    color: '#F5B731',
  },
  {
    icon: TrendingDown,
    title: "Signal guruhlarida yolg'on signal ko'pmi?",
    desc: "Telegram dagi tekin signal guruhlari asosan reklama uchun ishlaydi. FATH AI har bir signalni chiqarishdan oldin ikki marta tekshiradi.",
    color: '#FF4D6A',
  },
  {
    icon: DollarSign,
    title: "Qo'lda savdo qilishda xato ko'pmi?",
    desc: "Qo'rquv va ochko'zlik savdoda eng katta dushman. AI his-tuyg'ular ta'sirida emas, faqat ma'lumotlarga tayanib qaror qiladi.",
    color: '#9D6FFF',
  },
];

const FEATURES = [
  {
    icon: Brain,
    title: 'FATH AI Ikki Tomonlama Tekshirish',
    desc: "Har bir signal 2 ta mustaqil AI modeli tomonidan alohida tekshiriladi. Ikkalasi ham \"HA\" demasa — signal BERILMAYDI. Shuning uchun aniqligi yuqori.",
    accent: '#9D6FFF', bg: 'rgba(157,111,255,0.08)', border: 'rgba(157,111,255,0.2)',
  },
  {
    icon: BarChart2,
    title: 'Grafik Sizga Tayyor Holda Keladi',
    desc: "Har bir signal bilan birga professional grafik tahlil ham yuboriladi — qayerga kirish, qayerda chiqish va nima uchun — hammasi rasmda ko'rinib turadi.",
    accent: '#5B8BFF', bg: 'rgba(91,139,255,0.08)', border: 'rgba(91,139,255,0.2)',
  },
  {
    icon: Activity,
    title: 'Muhim Yangiliklar Signalni To\'xtatadi',
    desc: "Fed, Markaziy bank yoki katta yangilik chiqsa — AI signalni avtomatik ushlab turadi. Yangilik kelishi bilan noto'g'ri vaqtda kirish xavfi yo'q.",
    accent: '#00D4AA', bg: 'rgba(0,212,170,0.08)', border: 'rgba(0,212,170,0.2)',
  },
  {
    icon: Bell,
    title: 'Telegramingizga Darhol Keladi',
    desc: "Signal tayyor bo'lgandan keyin 3 daqiqada Telegram kanalingizga grafik va tahlil bilan birga yetkaziladi. Kompyuter oldida o'tirish shart emas.",
    accent: '#22D3EE', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)',
  },
  {
    icon: Target,
    title: 'TP va SL Avtomatik Hisoblanadi',
    desc: "Har bir signalda aniq kirish narxi, 3 ta daromad maqsadi va stop-loss beriladi. Siz faqat buyruq berasiz — hisob-kitobni AI qiladi.",
    accent: '#F5B731', bg: 'rgba(245,183,49,0.08)', border: 'rgba(245,183,49,0.2)',
  },
  {
    icon: Shield,
    title: 'Qancha Xavfga Borishni Ko\'rasiz',
    desc: "Har bir signalda depozitingizning necha foizi xavf ostida ekani ko'rsatiladi. Hech qachon o'ylamasdan katta pozitsiya ochish xavfi yo'q.",
    accent: '#FF4D6A', bg: 'rgba(255,77,106,0.08)', border: 'rgba(255,77,106,0.2)',
  },
];

const STEPS = [
  {
    num: '01', title: "Ro'yxatdan O'ting", color: '#00D4AA',
    desc: "2 daqiqada akkount oching. Karta yoki to'lov talab qilinmaydi. Birinchi 7 kun Premium imkoniyatlar bilan bepul.",
  },
  {
    num: '02', title: 'Telegram Kanalingizga Ulaning', color: '#5B8BFF',
    desc: "FATH AI Telegram kanaliga qo'shiling. Signal kelganda bildirishnoma olasiz — hech narsa o'tkazib yuborilmaydi.",
  },
  {
    num: '03', title: 'Signal Kuting', color: '#9D6FFF',
    desc: "AI 24/7 bozorni kuzatib turadi. Siz uxlab yotganda ham signal tayyor bo'lsa — Telegramingizga keladi.",
  },
  {
    num: '04', title: 'Kirish va Daromad', color: '#F5B731',
    desc: "Signal keldi — grafikni ko'rasiz, kirish va chiqish narxlarini ko'rasiz, bir tugma bosasiz. Qolganini AI kuzatib boradi.",
  },
];

const RESULTS = [
  { pair: 'XAU/USD', dir: 'BUY' as const, result: 'TP2 ✓', pips: '+420', date: '02.04.2026', color: '#00D4AA' },
  { pair: 'EUR/USD', dir: 'BUY' as const, result: 'TP1 ✓', pips: '+85', date: '01.04.2026', color: '#00D4AA' },
  { pair: 'BTC/USDT', dir: 'SELL' as const, result: 'TP3 ✓', pips: '+1,840', date: '01.04.2026', color: '#00D4AA' },
  { pair: 'GBP/USD', dir: 'BUY' as const, result: 'SL ✗', pips: '-42', date: '31.03.2026', color: '#FF4D6A' },
  { pair: 'ETH/USDT', dir: 'BUY' as const, result: 'TP2 ✓', pips: '+920', date: '30.03.2026', color: '#00D4AA' },
  { pair: 'USD/JPY', dir: 'SELL' as const, result: 'TP1 ✓', pips: '+68', date: '29.03.2026', color: '#00D4AA' },
];

const TESTIMONIALS = [
  {
    name: 'Jasur T.', role: 'Toshkent — 8 oylik foydalanuvchi',
    text: "Avval Investor Index va boshqa guruhlarda yurardim. Hech biri ishonchli emas edi. FATH AI da birinchi oydayoq 340% daromad ko'rdim. Hozir kuniga 1 soat savdoga ajrataman xolos.",
    rating: 5, profit: '+340%', period: '3 oyda',
  },
  {
    name: 'Malika R.', role: 'Samarqand — Kripto investor',
    text: "Ayol kishi uchun grafik o'rganish qiyin edi. FATH AI hamma narsani tayyor holda yuboradi — grafik, tushuntirish, narxlar. Men faqat tasdiqlash bosaman.",
    rating: 5, profit: '+220%', period: '2 oyda',
  },
  {
    name: 'Bobur X.', role: 'Andijon — Kunduzgi ishim bor',
    text: "Har kuni ofisda ishlayman. FATH AI signal chiqaradi, Telegram ga keladi — tushlik paytida 2 daqiqada savdoni ochamiz. Kechqurun natijani ko'raman.",
    rating: 5, profit: '+180%', period: '6 oyda',
  },
];

const FAQS = [
  {
    q: 'FATH AI ga qancha pul bilan boshlash mumkin?',
    a: 'Istalgan summadan boshlash mumkin. Signal sifati depozit miqdoridan bog\'liq emas. Ko\'pchilik foydalanuvchimiz 100-500 dollar bilan boshlagan.'
  },
  {
    q: 'Signal kelsa men nima qilaman?',
    a: 'Telegram ga signal keladi — kirish narxi, TP va SL yozilgan bo\'ladi. Bo\'sh vaqtingizda broker platformangizda buyruq qo\'yasiz. Jami 2-3 daqiqa ketadi.'
  },
  {
    q: 'Forex va kripto bilan tajribam yo\'q, bo\'ladimi?',
    a: 'Ha. FATH AI hamma narsa bilan birga tushuntirish ham yuboradi. Shuningdek Premium va VIP foydalanuvchilar uchun boshlang\'ich qo\'llanma taqdim etiladi.'
  },
  {
    q: 'Har bir signal doim daromad keltira di deb umid qila olamanmi?',
    a: 'Yo\'q. Hech qaysi tizim 100% emas. FATH AI 89% muvaffaqiyatga ega — demak 10 ta signalning 1-2 tasida stop-loss ishlaydi. Shuning uchun har bir signalda kichik risk beriladi.'
  },
  {
    q: 'Bepul versiya qanchalik ishlaydi?',
    a: 'Bepul versiyada kuniga 3 ta signal olasiz. Grafik tahlilsiz — faqat kirish va TP/SL narxlari. Sinab ko\'rish uchun yetarli.'
  },
];

function SCard({ pair, dir, entry, tp1, tp2, sl, score, color }: { pair: string; dir: 'BUY' | 'SELL'; entry: string; tp1: string; tp2: string; sl: string; score: number; color: string }) {
  const buy = dir === 'BUY';
  return (
    <div style={{ background: '#0F1118', border: `1px solid ${buy ? 'rgba(0,212,170,0.2)' : 'rgba(255,77,106,0.2)'}`, borderRadius: 16, padding: 16, width: 195, flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#EEEEF0' }}>{pair}</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 4, background: buy ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)', color: buy ? '#00D4AA' : '#FF4D6A', border: `1px solid ${buy ? 'rgba(0,212,170,0.3)' : 'rgba(255,77,106,0.3)'}` }}>{dir}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[{ l: 'Kirish', v: entry }, { l: 'TP1', v: tp1 }, { l: 'TP2', v: tp2 }, { l: 'SL', v: sl }].map((r) => (
          <div key={r.l}><div style={{ fontSize: 10, color: '#555568', marginBottom: 1 }}>{r.l}</div><div style={{ fontSize: 11, fontWeight: 600, color: '#EEEEF0', fontFamily: 'monospace' }}>{r.v}</div></div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#555568' }}>AI Ishonch</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}%</span>
      </div>
      <div style={{ marginTop: 4, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
        <div style={{ height: '100%', width: `${score}%`, borderRadius: 10, background: color }} />
      </div>
    </div>
  );
}

export default async function Home() {
  const plans = await getActivePlans();
  return (
    <div style={{ background: '#07080C', minHeight: '100vh', overflowX: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* NAVBAR */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(7,8,12,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <nav style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, overflow: 'hidden' }}>
              <Image src="/logo2.png" alt="FATH AI" width={34} height={34} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#EEEEF0', letterSpacing: '-0.02em' }}>FATH<span style={{ color: '#00D4AA' }}> AI</span></span>
          </Link>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {[{ label: 'Xususiyatlar', href: '#xususiyatlar' }, { label: 'Narxlar', href: '#narxlar' }, { label: 'Sharhlar', href: '#sharhlar' }].map((item) => (
              <a key={item.href} href={item.href} style={{ color: '#8888A0', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>{item.label}</a>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/login" style={{ color: '#8888A0', fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '8px 16px' }}>Kirish</Link>
            <Link href="/register" style={{ background: 'linear-gradient(135deg, #00D4AA, #00B896)', color: '#07080C', fontSize: 14, fontWeight: 700, textDecoration: 'none', padding: '9px 20px', borderRadius: 9 }}>Boshlash </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px', background: 'radial-gradient(ellipse 900px 500px at 50% 0%, rgba(0,212,170,0.12) 0%, transparent 70%), radial-gradient(ellipse 600px 400px at 90% 40%, rgba(91,139,255,0.08) 0%, transparent 60%), #07080C', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 100, padding: '6px 16px', marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 8px #00D4AA', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: '#00D4AA', fontSize: 13, fontWeight: 600 }}>FATH AI — Jonli Tahlil</span>
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', maxWidth: 900, color: '#EEEEF0', marginBottom: 8 }}>Forex va Kripto uchun</h1>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', maxWidth: 900, marginBottom: 24, background: 'linear-gradient(135deg, #00D4AA 0%, #5B8BFF 50%, #9D6FFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Eng Aqlli AI Signal</h1>
        <p style={{ fontSize: 'clamp(15px, 2vw, 19px)', color: '#8888A0', maxWidth: 600, lineHeight: 1.7, marginBottom: 48 }}>
          Grafik bilan soatlab o'tirmasdan daromad oling. FATH AI 24/7 bozorni kuzatadi, signal tayyor bo'lsa Telegramingizga keladi.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 72 }}>
          <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #00D4AA, #00B896)', color: '#07080C', fontSize: 16, fontWeight: 700, textDecoration: 'none', padding: '14px 32px', borderRadius: 12, boxShadow: '0 0 30px rgba(0,212,170,0.3)' }}>Bepul Boshlash <ArrowRight size={18} /></Link>
          <a href="#qanday-ishlaydi" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#EEEEF0', fontSize: 16, fontWeight: 600, textDecoration: 'none', padding: '14px 32px', borderRadius: 12 }}>Qanday ishlaydi <ChevronRight size={18} /></a>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#555568', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 14, textTransform: 'uppercase' }}>Jonli Signallar Ko'rinishi</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <SCard pair="XAU/USD" dir="BUY" entry="2,318.50" tp1="2,334.00" tp2="2,350.00" sl="2,308.00" score={92} color="#00D4AA" />
            <SCard pair="EUR/USD" dir="BUY" entry="1.08654" tp1="1.09200" tp2="1.09800" sl="1.08300" score={87} color="#5B8BFF" />
            <SCard pair="BTC/USDT" dir="SELL" entry="67,420" tp1="65,800" tp2="64,200" sl="68,900" score={84} color="#FF4D6A" />
            <SCard pair="GBP/USD" dir="BUY" entry="1.26540" tp1="1.27100" tp2="1.27850" sl="1.26100" score={78} color="#9D6FFF" />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ background: '#0F1118', padding: '36px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 6 }}>{s.value}</div>
              <div style={{ color: '#EEEEF0', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: '#555568', fontSize: 12 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PAIN POINTS */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#FF4D6A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Muammo</div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#EEEEF0', marginBottom: 12 }}>Ko&apos;pchilik Treyder Nima Sababdan Yutqazadi?</h2>
            <p style={{ color: '#8888A0', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>FATH AI aynan shu muammolarni hal qilish uchun yaratildi.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {PAIN_POINTS.map((p, i) => (
              <div key={i} style={{ background: '#0F1118', border: `1px solid ${p.color}20`, borderRadius: 20, padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: p.color, opacity: 0.5 }} />
                <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 20, background: `${p.color}12`, border: `1px solid ${p.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p.icon size={22} color={p.color} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 17, color: '#EEEEF0', marginBottom: 10 }}>{p.title}</h3>
                <p style={{ color: '#8888A0', fontSize: 14, lineHeight: 1.7 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="xususiyatlar" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#00D4AA', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Xususiyatlar</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#EEEEF0', marginBottom: 16 }}>
              Professional Savdo uchun <br /><span style={{ background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Barcha Kerakli Vositalar</span>
            </h2>
            <p style={{ color: '#8888A0', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>Texnik va fundamental tahlilni birlashtiradi  institucional savdogarlar ishlatiladigan usullar.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: '#0F1118', padding: '32px 28px' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 20, background: f.bg, border: `1px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <f.icon size={22} color={f.accent} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 17, color: '#EEEEF0', marginBottom: 10 }}>{f.title}</h3>
                <p style={{ color: '#8888A0', fontSize: 14, lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS TABLE */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#00D4AA', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Natijalar</div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#EEEEF0', marginBottom: 12 }}>Oxirgi 7 Kunlik Signallar</h2>
            <p style={{ color: '#8888A0', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>Haqiqiy natijalar — hech qanday filtrlashsiz. Yutqazgan signallar ham ko&apos;rsatiladi.</p>
          </div>
          <div style={{ background: '#0F1118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 80px 100px', padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {["Juftlik", "Yo'nalish", 'Natija', 'Pips', 'Sana'].map((h) => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#555568', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            {RESULTS.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 80px 100px', padding: '16px 24px', borderBottom: i < RESULTS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#EEEEF0' }}>{r.pair}</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: r.dir === 'BUY' ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)', color: r.dir === 'BUY' ? '#00D4AA' : '#FF4D6A', border: `1px solid ${r.dir === 'BUY' ? 'rgba(0,212,170,0.2)' : 'rgba(255,77,106,0.2)'}`, display: 'inline-block', textAlign: 'center' }}>{r.dir}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.result}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: r.color, fontFamily: 'monospace' }}>{r.pips}</span>
                <span style={{ fontSize: 12, color: '#555568' }}>{r.date}</span>
              </div>
            ))}
            <div style={{ padding: '16px 24px', background: 'rgba(0,212,170,0.04)', borderTop: '1px solid rgba(0,212,170,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#8888A0' }}>Oxirgi 7 kun: <strong style={{ color: '#EEEEF0' }}>6 signal</strong></span>
              <span style={{ fontSize: 13, color: '#00D4AA', fontWeight: 700 }}>5 TP ✓ · 1 SL ✗ · 83% muvaffaqiyat</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="qanday-ishlaydi" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#5B8BFF', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Jarayon</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#EEEEF0' }}>
              Signal <span style={{ background: 'linear-gradient(135deg, #5B8BFF, #9D6FFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>4 Qadamda</span> Tayyor
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ background: '#0F1118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '32px 28px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: step.color, marginBottom: 16, opacity: 0.6 }}>{step.num}</div>
                <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 20, background: `${step.color}12`, border: `1px solid ${step.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: step.color, boxShadow: `0 0 12px ${step.color}` }} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 17, color: '#EEEEF0', marginBottom: 12 }}>{step.title}</h3>
                <p style={{ color: '#8888A0', fontSize: 14, lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="narxlar" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#F5B731', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Narxlar</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#EEEEF0' }}>
              O'zingizga Mos <span style={{ background: 'linear-gradient(135deg, #F5B731, #FF8C42)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Tarif Tanlang</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {plans.map((plan, i) => (
              <div key={i} style={{ background: plan.highlight ? '#0B1C18' : '#0F1118', border: plan.highlight ? '1px solid rgba(0,212,170,0.3)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: '36px 32px', position: 'relative', boxShadow: plan.highlight ? '0 0 60px rgba(0,212,170,0.08)' : 'none' }}>
                {plan.highlight && (<div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #00D4AA, #00B896)', color: '#07080C', fontSize: 11, fontWeight: 800, padding: '4px 18px', borderRadius: '0 0 10px 10px', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>ENG MASHHUR</div>)}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: plan.color, marginBottom: 8 }}>{plan.name}</div>
                  <div style={{ fontSize: plan.price === '$0' ? 38 : 32, fontWeight: 800, color: '#EEEEF0', letterSpacing: '-0.03em', marginBottom: 4 }}>{plan.price === '$0' ? 'Bepul' : plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: '#555568' }}>{plan.period}</span></div>
                  <div style={{ color: '#555568', fontSize: 13 }}>{plan.desc}</div>
                </div>
                <div style={{ marginBottom: 28 }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <CheckCircle size={15} color={plan.color} />
                      <span style={{ color: '#EEEEF0', fontSize: 14 }}>{f}</span>
                    </div>
                  ))}
                  {plan.missing.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, opacity: 0.3 }}>
                      <div style={{ width: 15, height: 1, background: '#555568', flexShrink: 0 }} />
                      <span style={{ color: '#555568', fontSize: 14 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href={`/register?plan=${plan.planName}`} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px 24px', borderRadius: 12, fontWeight: 700, fontSize: 15, background: plan.highlight ? 'linear-gradient(135deg, #00D4AA, #00B896)' : plan.planName === 'vip' || plan.planName === 'ultimate' ? 'linear-gradient(135deg, #F5B731, #FF8C42)' : 'rgba(255,255,255,0.06)', color: plan.highlight || plan.planName === 'vip' || plan.planName === 'ultimate' ? '#07080C' : '#EEEEF0', border: plan.highlight || plan.planName === 'vip' || plan.planName === 'ultimate' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>{plan.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="sharhlar" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#9D6FFF', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Sharhlar</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#EEEEF0' }}>
              Foydalanuvchilar <span style={{ background: 'linear-gradient(135deg, #9D6FFF, #5B8BFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Nima Deyishadi</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: '#0F1118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '28px 24px' }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                  {Array(t.rating).fill(0).map((_, j) => (<Star key={j} size={14} color="#F5B731" fill="#F5B731" />))}
                </div>
                <p style={{ color: '#8888A0', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>"{t.text}"</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#07080C' }}>{t.name[0]}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#EEEEF0' }}>{t.name}</div>
                      <div style={{ color: '#555568', fontSize: 12 }}>{t.role}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#00D4AA' }}>{t.profit}</div>
                    <div style={{ fontSize: 11, color: '#555568' }}>{t.period}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#5B8BFF', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Savollar</div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#EEEEF0' }}>Tez-tez So&apos;raladigan Savollar</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ background: '#0F1118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px 28px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(91,139,255,0.1)', border: '1px solid rgba(91,139,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#5B8BFF' }}>?</span>
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16, color: '#EEEEF0', marginBottom: 10 }}>{faq.q}</h3>
                    <p style={{ color: '#8888A0', fontSize: 14, lineHeight: 1.7 }}>{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', background: 'linear-gradient(135deg, #0B1C18 0%, #0B1220 100%)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 28, padding: '72px 48px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 100, padding: '6px 16px', marginBottom: 28 }}>
            <Zap size={13} color="#00D4AA" />
            <span style={{ color: '#00D4AA', fontSize: 13, fontWeight: 600 }}>Bugun boshlang</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#EEEEF0', marginBottom: 16, lineHeight: 1.1 }}>
            Savdoni AI bilan<br /><span style={{ background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Yangi Darajaga Olib Chiqing</span>
          </h2>
          <p style={{ color: '#8888A0', fontSize: 17, marginBottom: 40, lineHeight: 1.6 }}>Hoziroq ro'yxatdan o'ting  birinchi 7 kun bepul Premium imkoniyatlar bilan. Karta talab qilinmaydi.</p>
          <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #00D4AA, #00B896)', color: '#07080C', fontSize: 16, fontWeight: 700, textDecoration: 'none', padding: '14px 36px', borderRadius: 12, boxShadow: '0 0 40px rgba(0,212,170,0.3)' }}>Bepul Boshlash <ArrowRight size={18} /></Link>
          <p style={{ color: '#555568', fontSize: 13, marginTop: 20 }}>3,200+ treyder allaqachon foydalanmoqda</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #00D4AA, #5B8BFF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={16} color="#07080C" strokeWidth={2.5} /></div>
                <span style={{ fontWeight: 800, fontSize: 17, color: '#EEEEF0' }}>Trader<span style={{ color: '#00D4AA' }}>AI</span></span>
              </div>
              <p style={{ color: '#555568', fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>Forex va Kripto bozori uchun professional sun'iy intellekt asosidagi savdo platformasi.</p>
            </div>
            {[
              { title: 'Platforma', links: [{ label: 'Xususiyatlar', href: '#xususiyatlar' }, { label: 'Narxlar', href: '#narxlar' }, { label: 'Sharhlar', href: '#sharhlar' }, { label: 'Dashboard', href: '/dashboard' }] },
              { title: 'Hisob', links: [{ label: 'Kirish', href: '/login' }, { label: "Ro'yxatdan o'tish", href: '/register' }, { label: 'Admin Panel', href: '/admin' }] },
            ].map((col) => (
              <div key={col.title}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#EEEEF0', marginBottom: 16 }}>{col.title}</div>
                {col.links.map((link) => (<a key={link.label} href={link.href} style={{ display: 'block', color: '#555568', fontSize: 13, marginBottom: 10, textDecoration: 'none' }}>{link.label}</a>))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ color: '#555568', fontSize: 13 }}> 2026 FATH AI. Barcha huquqlar himoyalangan.</span>
            <span style={{ color: '#555568', fontSize: 13 }}>O'zbekiston </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
