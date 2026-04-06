// ============================================================
// Deriv Binary WebSocket Fetcher — server-side only
// wss://ws.binaryws.com/websockets/v3?app_id=1089
//
// Bepul, API key shart emas.
// app_id=1089 — Deriv'ning umumiy demo app_id
//
// Bitta WebSocket orqali BIR SYMBOL uchun BARCHA timeframe
// bir vaqtda so'raladi (multiplexed, req_id = granularity)
// Javoblar kelganda Firestore cache ga yoziladi.
//
// Qo'llab-quvvatlanadigan symbollar:
//   Forex:  EURUSD GBPUSD USDJPY USDCHF AUDUSD USDCAD NZDUSD EURGBP EURJPY GBPJPY
//   Metals: XAUUSD (spot) XAGUSD (spot)
//   Oil:    USOIL
// ============================================================

import type { OHLCVCandle } from '@/types';

const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';

// Bizning symbol → Deriv symbol (SPOT, futures emas)
export const DERIV_SYMBOL_MAP: Record<string, string> = {
  EURUSD:  'frxEURUSD',
  GBPUSD:  'frxGBPUSD',
  USDJPY:  'frxUSDJPY',
  USDCHF:  'frxUSDCHF',
  AUDUSD:  'frxAUDUSD',
  USDCAD:  'frxUSDCAD',
  NZDUSD:  'frxNZDUSD',
  EURGBP:  'frxEURGBP',
  EURJPY:  'frxEURJPY',
  GBPJPY:  'frxGBPJPY',
  XAUUSD:  'frxXAUUSD',   // SPOT OLTIN — GC=F futures EMAS
  XAGUSD:  'frxXAGUSD',   // SPOT KUMUSH
  USOIL:   'WTIUSD',      // WTI xom neft
};

// Timeframe → Deriv granularity (soniyalarda)
export const DERIV_GRANULARITY: Record<string, number> = {
  '5m':  300,
  '15m': 900,
  '30m': 1800,
  '1h':  3600,
  '4h':  14400,
  '1d':  86400,
};

// Granularity → timeframe (teskari map, req_id orqali javobni aniqlash uchun)
const GRAN_TO_TF: Record<number, string> = Object.fromEntries(
  Object.entries(DERIV_GRANULARITY).map(([tf, g]) => [g, tf]),
);

interface DerivCandle {
  epoch: number;
  open:  string;
  high:  string;
  low:   string;
  close: string;
}

interface DerivResponse {
  msg_type: string;
  candles?: DerivCandle[];
  req_id?:  number;
  error?:   { message: string };
}

/**
 * Bitta WebSocket ulanish orqali bir symbol uchun
 * bir nechta timeframe OHLCV ma'lumotini oladi.
 *
 * @returns Record<timeframe, OHLCVCandle[]> — muvaffaqiyatli timeframelar
 *          Xato bo'lgan timeframlar natijadan chiqarib tashlanadi.
 */
export async function fetchDerivMultiTF(
  symbol: string,
  timeframes: string[],
  count = 200,
): Promise<Record<string, OHLCVCandle[]>> {
  const derivSym = DERIV_SYMBOL_MAP[symbol.toUpperCase()];
  if (!derivSym) throw new Error(`Deriv: qo'llab-quvvatlanmagan symbol: ${symbol}`);

  const validTFs = timeframes.filter(tf => tf in DERIV_GRANULARITY);
  if (validTFs.length === 0) throw new Error(`Deriv: mos keladigan timeframe yo'q`);

  return new Promise<Record<string, OHLCVCandle[]>>((resolve, reject) => {
    const results: Record<string, OHLCVCandle[]> = {};
    const pending = new Set(validTFs);
    let settled = false;

    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      if (err && Object.keys(results).length === 0) {
        reject(err);
      } else {
        resolve(results); // qisman muvaffaqiyat ham qaytariladi
      }
    };

    // 25 soniya timeout — barcha timeframelar uchun yetarli
    const timer = setTimeout(
      () => done(new Error(`Deriv: timeout (${symbol})`)),
      25_000,
    );

    let ws: WebSocket;
    try {
      ws = new WebSocket(DERIV_WS_URL);
    } catch (e) {
      clearTimeout(timer);
      reject(new Error(`Deriv: WebSocket ochib bo'lmadi: ${e}`));
      return;
    }

    ws.onopen = () => {
      // Barcha timeframe so'rovlarini bir vaqtda yuboramiz (req_id = granularity)
      for (const tf of validTFs) {
        const granularity = DERIV_GRANULARITY[tf];
        ws.send(JSON.stringify({
          ticks_history:    derivSym,
          adjust_start_time: 1,
          count,
          end:              'latest',
          start:            1,
          style:            'candles',
          granularity,
          req_id:           granularity, // granularity unique → javobni aniqlash uchun
        }));
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as DerivResponse;

        if (data.error) {
          // Bu timeframe uchun xato — pending dan olib tashlaymiz, davom etamiz
          const tf = data.req_id ? GRAN_TO_TF[data.req_id] : undefined;
          console.warn(`[Deriv] ${symbol} req_id=${data.req_id} xato: ${data.error.message}`);
          if (tf) pending.delete(tf);
          if (pending.size === 0) done();
          return;
        }

        if (data.msg_type === 'candles' && Array.isArray(data.candles) && data.req_id) {
          const tf = GRAN_TO_TF[data.req_id];
          if (tf) {
            results[tf] = (data.candles as DerivCandle[])
              .map(c => ({
                timestamp: c.epoch * 1000,
                open:      parseFloat(c.open),
                high:      parseFloat(c.high),
                low:       parseFloat(c.low),
                close:     parseFloat(c.close),
                volume:    0,
              }))
              .filter(c => isFinite(c.open) && c.open > 0);
            pending.delete(tf);
          }
          if (pending.size === 0) done();
        }
      } catch {
        // JSON parse xato — e'tiborsiz qoldiramiz, timeout hal qiladi
      }
    };

    ws.onerror = () => {
      done(new Error(`Deriv: WebSocket xato (${symbol})`));
    };

    ws.onclose = (ev: CloseEvent) => {
      if (!settled && !ev.wasClean) {
        done(new Error(`Deriv: WebSocket yopildi (${symbol}, code=${ev.code})`));
      }
    };
  });
}

/** Symbol Deriv orqali qo'llab-quvvatlanishini tekshirish */
export function isDerivSymbol(symbol: string): boolean {
  return symbol.toUpperCase() in DERIV_SYMBOL_MAP;
}
