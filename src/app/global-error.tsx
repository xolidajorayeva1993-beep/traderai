'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html>
      <body style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#07080C', flexDirection: 'column', gap: 16, padding: 24, margin: 0,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.25)',
          borderRadius: 16, padding: '2rem', maxWidth: 480, textAlign: 'center',
        }}>
          <p style={{ color: '#FF4D6A', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            Sahifa yuklanmadi
          </p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 20 }}>
            {error.message || 'Noma\'lum xato'}
          </p>
          <button
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #00D4AA, #0099FF)',
              border: 'none', borderRadius: 10, padding: '10px 24px',
              color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  );
}
