'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#07080C', flexDirection: 'column', gap: 16, padding: 24,
    }}>
      <div style={{
        background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.25)',
        borderRadius: 16, padding: '2rem', maxWidth: 480, textAlign: 'center',
      }}>
        <p style={{ color: '#FF4D6A', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          Dashboard yuklanmadi
        </p>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 20 }}>
          {error.message || 'Noma\'lum xato yuz berdi'}
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
    </div>
  );
}
