import Link from 'next/link';

export default function NotFound() {
  return (
    <html lang="uz">
      <body style={{ background: '#07080C', margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '2rem',
        }}>
          {/* Glow dot */}
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,170,0.25) 0%, transparent 70%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.5rem',
          }}>
            <span style={{ fontSize: 48, lineHeight: 1 }}>🔍</span>
          </div>

          <p style={{ color: '#00D4AA', fontSize: 14, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            Xato 404
          </p>
          <h1 style={{ color: '#EEEEF0', fontSize: 48, fontWeight: 900, margin: '0 0 12px' }}>
            Sahifa topilmadi
          </h1>
          <p style={{ color: '#555568', fontSize: 16, maxWidth: 480, margin: '0 auto 2rem', lineHeight: 1.6 }}>
            Siz qidirayotgan sahifa mavjud emas yoki ko'chirib o'tirilgan. URL manzilini tekshiring.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/dashboard" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 10, fontWeight: 700, fontSize: 15,
              background: '#00D4AA', color: '#07080C', textDecoration: 'none',
              transition: 'opacity .2s',
            }}>
              Bosh sahifaga qaytish
            </Link>
            <Link href="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 10, fontWeight: 600, fontSize: 15,
              background: 'rgba(255,255,255,0.05)', color: '#EEEEF0',
              border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none',
            }}>
              Asosiy sahifa
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
