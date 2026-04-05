// ============================================================
// TraderAI — Global TypeScript Types
// ============================================================

// ─── Market Data ──────────────────────────────────────────────
export interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LivePrice {
  symbol: string;
  bid: number;
  ask: number;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  updatedAt: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export type AssetType = 'forex' | 'crypto' | 'indices' | 'commodities';

export interface MarketSymbol {
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
}

// ─── Technical Analysis ────────────────────────────────────────
export interface SNRLevel {
  price: number;
  strength: number;
  type: 'support' | 'resistance';
  touches: number;
  lastTouched: number;
}

export interface TrendLine {
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  type: 'uptrend' | 'downtrend' | 'horizontal';
  strength: number;
}

export interface FibonacciLevels {
  swing_high: number;
  swing_low: number;
  levels: Record<string, number>;
}

export interface GannLevel {
  price: number;
  type: 'gann_fan' | 'gann_square' | 'gann_circle';
  angle?: number;
}

export interface IndicatorValues {
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  ema20: number;
  ema50: number;
  ema200: number;
  bollinger: { upper: number; middle: number; lower: number };
  atr: number;
  adx: number;
  stochastic: { k: number; d: number };
}

// ─── Signals ───────────────────────────────────────────────────
export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';
export type SignalStatus = 'active' | 'tp_hit' | 'sl_hit' | 'expired' | 'pending';
export type SignalConfidence = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface SignalTarget {
  price: number;
  pips: number;
  riskReward: number;
  probability: number;
}

export interface StrategyResult {
  strategyId: string;
  strategyName: string;
  signal: SignalDirection;
  confidence: number;
  reasons: string[];
}

export interface Signal {
  id: string;
  pair: string;
  assetType: AssetType;
  direction: SignalDirection;
  timeframe: Timeframe;
  entryPrice: number;
  entryZone: [number, number];
  targets: SignalTarget[];
  stopLoss: number;
  stopLossPips: number;
  confidence: SignalConfidence;
  confidenceScore: number;
  status: SignalStatus;
  chartImages: {
    overview: string;
    entry: string;
    multi_timeframe?: string;
  };
  strategiesTriggered: StrategyResult[];
  consensus: {
    fathAI_primary: SignalDirection;
    fathAI_secondary: SignalDirection;
    final: SignalDirection;
    agreement: boolean;
  };
  analysis: {
    technical: string;
    fundamental?: string;
    sentiment?: string;
    summary: string;
  };
  marketCondition: 'trending' | 'ranging' | 'breakout' | 'reversal';
  sessionTime: 'london' | 'new_york' | 'tokyo' | 'sydney' | 'overlap';
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: number;
  expiresAt: number;
  updatedAt: number;
}

// ─── Strategies ────────────────────────────────────────────────
export interface StrategyRule {
  type: 'indicator' | 'pattern' | 'snr' | 'trendline' | 'fibonacci' | 'gann' | 'smc';
  name: string;
  params: Record<string, unknown>;
  weight: number;
  condition: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'technical' | 'fundamental' | 'hybrid';
  rules: StrategyRule[];
  weight: number;
  winRate: number;
  totalSignals: number;
  profitFactor: number;
  isActive: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Users ─────────────────────────────────────────────────────
export type UserRole = 'admin' | 'premium' | 'free';
export type PlanId = 'free' | 'pro' | 'vip';

export interface UserNotifSettings {
  signal_alerts:  boolean;
  news_alerts:    boolean;
  price_alerts:   boolean;
  weekly_report:  boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  plan: PlanId;
  planExpiresAt?: number | null;
  planActivatedAt?: number | null;
  trialEndsAt?: number | null;
  telegramId?: string;
  telegramUsername?: string;
  language?: string;
  theme?: 'dark' | 'light';
  notifSettings?: UserNotifSettings;
  createdAt: number;
  lastSeen: number;
  isActive: boolean;
  referralCode: string;
  referredBy?: string;
}

export interface Subscription {
  uid: string;
  planId: PlanId;
  startDate: number;
  endDate: number;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  paymentMethod: 'stripe' | 'payme' | 'click' | 'free';
  amount: number;
  currency: 'USD' | 'UZS';
}

// ─── AI Prompts ─────────────────────────────────────────────────
export interface AIPrompt {
  id: string;
  name: string;
  type: 'signal_analysis' | 'market_summary' | 'fundamental' | 'chart_description';
  content: string;
  model: 'fath-ai-primary' | 'fath-ai-fast' | 'fath-ai-vision';
  version: number;
  isActive: boolean;
  tokens: number;
  updatedAt: number;
}

// ─── Notifications ──────────────────────────────────────────────
export interface Notification {
  id: string;
  uid: string;
  type: 'signal' | 'tp_hit' | 'sl_hit' | 'news' | 'system';
  title: string;
  body: string;
  signalId?: string;
  read: boolean;
  createdAt: number;
}

// ─── Plans ──────────────────────────────────────────────────────
export interface Plan {
  id: PlanId;
  name: string;
  priceUSD: number;
  priceUZS: number;
  features: string[];
  signalsPerDay: number;
  pairs: string[];
  hasAutoTrade: boolean;
  hasTelegram: boolean;
  hasAPI: boolean;
}

// ─── API Responses ──────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Zustand Auth Store ─────────────────────────────────────────
export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  initialized: boolean;
}
