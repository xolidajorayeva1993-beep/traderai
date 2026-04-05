// ============================================================
// Binance WebSocket Manager — client-side real-time prices
// Features:
//   • Subscribes to multiple symbols with one combined stream
//   • Auto-reconnect with exponential backoff (max 30s)
//   • Graceful cleanup on unmount
//   • Notifies subscribers via callbacks
// ============================================================

const WS_BASE = 'wss://stream.binance.com:9443/stream';
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export interface BinanceTicker {
  symbol:        string;  // e.g. BTCUSDT
  price:         number;
  change:        number;
  changePercent: number;
  volume:        number;
  bid:           number;
  ask:           number;
  high:          number;
  low:           number;
  updatedAt:     number;
}

type TickerCallback = (ticker: BinanceTicker) => void;

// ─── Binance stream message shapes ───────────────────────────
interface BinanceMiniTickerEvent {
  e: '24hrMiniTicker';
  s: string;   // symbol
  c: string;   // close price
  o: string;   // open price
  h: string;   // high
  l: string;   // low
  v: string;   // volume
}

// ─── Manager class ────────────────────────────────────────────
class BinanceWebSocketManager {
  private ws:         WebSocket | null = null;
  private symbols:    string[]         = [];
  private callbacks:  Map<string, Set<TickerCallback>> = new Map();
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosed   = false;                  // true after explicit destroy()
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  /** Subscribe to real-time updates for a symbol. Returns unsubscribe fn. */
  subscribe(symbol: string, cb: TickerCallback): () => void {
    const sym = symbol.toUpperCase();
    if (!this.callbacks.has(sym)) this.callbacks.set(sym, new Set());
    this.callbacks.get(sym)!.add(cb);
    this._ensureConnected();
    return () => this._unsubscribe(sym, cb);
  }

  private _unsubscribe(symbol: string, cb: TickerCallback): void {
    const set = this.callbacks.get(symbol);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) this.callbacks.delete(symbol);
    if (this.callbacks.size === 0) this._closeWs();
  }

  private _ensureConnected(): void {
    const needed = Array.from(this.callbacks.keys());
    if (needed.length === 0) return;

    // Reconnect if symbol list changed or WS not open
    const changed = needed.join(',') !== this.symbols.join(',');
    if (changed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.symbols = needed;
      this._connect();
    }
  }

  private _connect(): void {
    this._closeWs();
    if (this.symbols.length === 0 || this.isClosed) return;

    // Combined stream: multiple symbols in one connection
    const streams = this.symbols
      .map((s) => `${s.toLowerCase()}@miniTicker`)
      .join('/');

    const url = `${WS_BASE}?streams=${streams}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      this._startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { data: BinanceMiniTickerEvent };
        const raw = msg.data;
        if (raw?.e !== '24hrMiniTicker') return;

        const close = parseFloat(raw.c);
        const open  = parseFloat(raw.o);
        const change = close - open;

        const ticker: BinanceTicker = {
          symbol:        raw.s,
          price:         close,
          change,
          changePercent: open > 0 ? (change / open) * 100 : 0,
          volume:        parseFloat(raw.v),
          bid:           close - 0.00001,
          ask:           close + 0.00001,
          high:          parseFloat(raw.h),
          low:           parseFloat(raw.l),
          updatedAt:     Date.now(),
        };

        const cbs = this.callbacks.get(raw.s);
        cbs?.forEach((cb) => cb(ticker));
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after error — handle reconnect there
    };

    this.ws.onclose = () => {
      this._stopPing();
      if (!this.isClosed && this.callbacks.size > 0) {
        this._scheduleReconnect();
      }
    };
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      this._connect();
    }, this.reconnectDelay);
  }

  private _startPing(): void {
    this._stopPing();
    // Send ping every 30s to keep connection alive
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: [], id: 1 }));
      }
    }, 30_000);
  }

  private _stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private _closeWs(): void {
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  /** Call on app unmount to cleanly close everything. */
  destroy(): void {
    this.isClosed = true;
    this._closeWs();
    this.callbacks.clear();
  }
}

// ─── Singleton instance (shared across all components) ────────
let _manager: BinanceWebSocketManager | null = null;

export function getBinanceWsManager(): BinanceWebSocketManager {
  if (!_manager) _manager = new BinanceWebSocketManager();
  return _manager;
}
