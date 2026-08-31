import type { Candle, Series } from '@/lib/types'
import { sma } from './sma'
import { ema } from './ema'
import { rsi } from './rsi'
import { macd } from './macd'
import { bollinger } from './bollinger'
import { atr } from './atr'
import { dema, hma, tema, vwap, vwma, wma } from './movingAverages'
import { donchian, ichimoku, keltner, parabolicSar, superTrend } from './channels'
import {
  adx,
  aroon,
  awesomeOscillator,
  cci,
  choppiness,
  dpo,
  elderRay,
  momentum,
  ppo,
  roc,
  stochastic,
  stochasticRsi,
  trix,
  ultimateOscillator,
  vortex,
  williamsR,
} from './momentum'
import {
  adLine,
  chaikinOscillator,
  cmf,
  easeOfMovement,
  forceIndex,
  mfi,
  obv,
  volumeOscillator,
} from './volume'
import { bollingerWidth, normalizedAtr, standardDeviation } from './volatilityBands'
import { volatility } from '@/lib/analysis/statistics/volatility'
import { drawdown } from '@/lib/analysis/statistics/drawdown'

/** Every numeric knob any indicator accepts. Kept explicit so the schema stays strict. */
export const NUMERIC_PARAM_KEYS = [
  'period',
  'fast',
  'slow',
  'signal',
  'stdDev',
  'multiplier',
  'atrPeriod',
  'smoothK',
  'smoothD',
  'stochPeriod',
  'rsiPeriod',
  'conversion',
  'base',
  'span',
  'step',
  'maxStep',
  'short',
  'medium',
  'long',
] as const
export type NumericParamKey = (typeof NUMERIC_PARAM_KEYS)[number]

export const INDICATOR_CATEGORIES = ['trend', 'momentum', 'volatility', 'volume'] as const
export type IndicatorCategory = (typeof INDICATOR_CATEGORIES)[number]

export type ParamSpec = { key: NumericParamKey; default: number; min?: number; max?: number }

export type OutputSpec = {
  key: string
  label: string
  style?: 'line' | 'histogram'
  color?: string
  /** Draw thinner/dimmer — used for band edges and secondary lines. */
  muted?: boolean
}

export type IndicatorSpec = {
  name: string
  /** Short badge label; the period is appended by the UI when there is one. */
  short: string
  category: IndicatorCategory
  /** `price` overlays candles, `volume` shares the volume scale, `own` gets a pane. */
  pane: 'price' | 'own' | 'volume'
  params: ParamSpec[]
  outputs: OutputSpec[]
  compute: (candles: Candle[], params: Record<string, number>) => Record<string, Series>
  /**
   * The value range, written for the model. Without it, thresholds get picked on
   * the wrong scale — a percentage indicator compared against 0.02, say.
   */
  scale?: string
  /** Horizontal reference lines drawn inside the pane. */
  guides?: number[]
  /**
   * Extra names the rule-based parser should recognise. The registry key and
   * `name` are always matched; only add distinctive words here — a two-letter
   * abbreviation would fire on ordinary prose.
   */
  aliases?: string[]
  description: { ko: string; en: string }
}

const closesOf = (candles: Candle[]) => candles.map((c) => c.close)
const p = (key: NumericParamKey, value: number, min?: number, max?: number): ParamSpec => ({
  key,
  default: value,
  ...(min !== undefined ? { min } : {}),
  ...(max !== undefined ? { max } : {}),
})

export const INDICATOR_REGISTRY = {
  /* ── trend / overlays ─────────────────────────────────────────────────── */
  SMA: {
    name: 'Simple Moving Average', short: 'SMA', category: 'trend', pane: 'price',
    params: [p('period', 20, 1, 1000)],
    outputs: [{ key: 'sma', label: 'SMA' }],
    compute: (c, x) => ({ sma: sma(closesOf(c), x.period ?? 20) }),
    aliases: ['이동평균', '이평', '단순이동평균', 'moving average'],
    description: { ko: '단순 이동평균', en: 'Simple moving average' },
  },
  EMA: {
    name: 'Exponential Moving Average', short: 'EMA', category: 'trend', pane: 'price',
    params: [p('period', 20, 1, 1000)],
    outputs: [{ key: 'ema', label: 'EMA' }],
    compute: (c, x) => ({ ema: ema(closesOf(c), x.period ?? 20) }),
    aliases: ['지수이동평균', '지수이평'],
    description: { ko: '지수 이동평균', en: 'Exponential moving average' },
  },
  WMA: {
    name: 'Weighted Moving Average', short: 'WMA', category: 'trend', pane: 'price',
    params: [p('period', 20, 1, 1000)],
    outputs: [{ key: 'wma', label: 'WMA' }],
    compute: (c, x) => ({ wma: wma(closesOf(c), x.period ?? 20) }),
    aliases: ['가중이동평균'],
    description: { ko: '최근 봉에 더 큰 가중치', en: 'Recent bars weighted more heavily' },
  },
  HMA: {
    name: 'Hull Moving Average', short: 'HMA', category: 'trend', pane: 'price',
    params: [p('period', 20, 2, 1000)],
    outputs: [{ key: 'hma', label: 'HMA' }],
    compute: (c, x) => ({ hma: hma(closesOf(c), x.period ?? 20) }),
    aliases: ['헐이동평균', 'hull'],
    description: { ko: '지연이 매우 적은 이동평균', en: 'Very low-lag moving average' },
  },
  DEMA: {
    name: 'Double EMA', short: 'DEMA', category: 'trend', pane: 'price',
    params: [p('period', 20, 1, 1000)],
    outputs: [{ key: 'dema', label: 'DEMA' }],
    compute: (c, x) => ({ dema: dema(closesOf(c), x.period ?? 20) }),
    description: { ko: 'EMA보다 지연이 적음', en: 'Less lag than a plain EMA' },
  },
  TEMA: {
    name: 'Triple EMA', short: 'TEMA', category: 'trend', pane: 'price',
    params: [p('period', 20, 1, 1000)],
    outputs: [{ key: 'tema', label: 'TEMA' }],
    compute: (c, x) => ({ tema: tema(closesOf(c), x.period ?? 20) }),
    description: { ko: 'DEMA보다 더 민감', en: 'Even more responsive than DEMA' },
  },
  VWMA: {
    name: 'Volume Weighted MA', short: 'VWMA', category: 'trend', pane: 'price',
    params: [p('period', 20, 1, 1000)],
    outputs: [{ key: 'vwma', label: 'VWMA' }],
    compute: (c, x) => ({ vwma: vwma(c, x.period ?? 20) }),
    aliases: ['거래량가중이동평균'],
    description: { ko: '거래량으로 가중한 이동평균', en: 'Moving average weighted by volume' },
  },
  VWAP: {
    name: 'VWAP (rolling)', short: 'VWAP', category: 'trend', pane: 'price',
    params: [p('period', 20, 1, 1000)],
    outputs: [{ key: 'vwap', label: 'VWAP' }],
    compute: (c, x) => ({ vwap: vwap(c, x.period ?? 20) }),
    aliases: ['거래량가중평균가'],
    description: { ko: '거래량 가중 평균가 (구간 기준)', en: 'Volume weighted average price over a window' },
  },
  BOLLINGER: {
    name: 'Bollinger Bands', short: 'BB', category: 'volatility', pane: 'price',
    params: [p('period', 20, 2, 1000), p('stdDev', 2, 0.1, 10)],
    outputs: [
      { key: 'upper', label: 'upper' },
      { key: 'middle', label: 'basis', muted: true },
      { key: 'lower', label: 'lower' },
    ],
    compute: (c, x) => bollinger(closesOf(c), x.period ?? 20, x.stdDev ?? 2),
    aliases: ['볼린저', '볼린저밴드', 'bollinger band'],
    description: { ko: '표준편차 기반 변동성 밴드', en: 'Standard-deviation volatility bands' },
  },
  KELTNER: {
    name: 'Keltner Channels', short: 'KC', category: 'volatility', pane: 'price',
    params: [p('period', 20, 2, 1000), p('multiplier', 2, 0.1, 10), p('atrPeriod', 10, 1, 500)],
    outputs: [
      { key: 'upper', label: 'upper' },
      { key: 'middle', label: 'basis', muted: true },
      { key: 'lower', label: 'lower' },
    ],
    compute: (c, x) => keltner(c, x.period ?? 20, x.multiplier ?? 2, x.atrPeriod ?? 10),
    aliases: ['켈트너', 'keltner channel'],
    description: { ko: 'ATR 기반 채널', en: 'ATR-scaled envelope around an EMA' },
  },
  DONCHIAN: {
    name: 'Donchian Channels', short: 'DC', category: 'volatility', pane: 'price',
    params: [p('period', 20, 2, 1000)],
    outputs: [
      { key: 'upper', label: 'high' },
      { key: 'middle', label: 'mid', muted: true },
      { key: 'lower', label: 'low' },
    ],
    compute: (c, x) => donchian(c, x.period ?? 20),
    aliases: ['돈치안', '돈키언', 'donchian channel'],
    description: { ko: '구간 내 최고가·최저가', en: 'Highest high and lowest low of the window' },
  },
  SUPERTREND: {
    name: 'SuperTrend', short: 'ST', category: 'trend', pane: 'price',
    params: [p('period', 10, 1, 500), p('multiplier', 3, 0.1, 20)],
    outputs: [{ key: 'trend', label: 'SuperTrend' }],
    compute: (c, x) => superTrend(c, x.period ?? 10, x.multiplier ?? 3),
    scale: 'a price level',
    aliases: ['슈퍼트렌드', 'super trend'],
    description: { ko: 'ATR 추세 추종선', en: 'ATR trend-following stop line' },
  },
  PSAR: {
    name: 'Parabolic SAR', short: 'PSAR', category: 'trend', pane: 'price',
    params: [p('step', 0.02, 0.001, 1), p('maxStep', 0.2, 0.01, 1)],
    outputs: [{ key: 'sar', label: 'SAR' }],
    compute: (c, x) => ({ sar: parabolicSar(c, x.step ?? 0.02, x.maxStep ?? 0.2) }),
    scale: 'a price level',
    aliases: ['파라볼릭', 'parabolic sar', 'parabolic'],
    description: { ko: '추세 전환 정지점', en: 'Stop-and-reverse trend dots' },
  },
  ICHIMOKU: {
    name: 'Ichimoku Cloud', short: 'Ichimoku', category: 'trend', pane: 'price',
    params: [p('conversion', 9, 1, 200), p('base', 26, 1, 400), p('span', 52, 1, 600)],
    outputs: [
      { key: 'conversion', label: 'tenkan' },
      { key: 'base', label: 'kijun' },
      { key: 'spanA', label: 'span A', muted: true },
      { key: 'spanB', label: 'span B', muted: true },
    ],
    compute: (c, x) => ichimoku(c, x.conversion ?? 9, x.base ?? 26, x.span ?? 52),
    aliases: ['일목균형표', '일목', 'ichimoku cloud'],
    description: { ko: '일목균형표', en: 'Ichimoku Kinko Hyo' },
  },

  /* ── momentum / own pane ──────────────────────────────────────────────── */
  RSI: {
    name: 'Relative Strength Index', short: 'RSI', category: 'momentum', pane: 'own',
    params: [p('period', 14, 2, 1000)],
    outputs: [{ key: 'rsi', label: 'RSI' }],
    compute: (c, x) => ({ rsi: rsi(closesOf(c), x.period ?? 14) }),
    guides: [30, 70],
    scale: '0..100',
    description: { ko: '상대강도지수 (0~100)', en: 'Relative strength, 0-100' },
  },
  MACD: {
    name: 'MACD', short: 'MACD', category: 'momentum', pane: 'own',
    params: [p('fast', 12, 1, 500), p('slow', 26, 2, 1000), p('signal', 9, 1, 500)],
    outputs: [
      { key: 'histogram', label: 'histogram', style: 'histogram' },
      { key: 'macd', label: 'MACD' },
      { key: 'signal', label: 'signal', color: '#f0b429' },
    ],
    compute: (c, x) => macd(closesOf(c), x.fast ?? 12, x.slow ?? 26, x.signal ?? 9),
    guides: [0],
    description: { ko: '이동평균 수렴·확산', en: 'Moving average convergence divergence' },
  },
  STOCH: {
    name: 'Stochastic', short: 'Stoch', category: 'momentum', pane: 'own',
    params: [p('period', 14, 1, 500), p('smoothK', 3, 1, 100), p('smoothD', 3, 1, 100)],
    outputs: [
      { key: 'k', label: '%K' },
      { key: 'd', label: '%D', color: '#f0b429' },
    ],
    compute: (c, x) => stochastic(c, x.period ?? 14, x.smoothK ?? 3, x.smoothD ?? 3),
    guides: [20, 80],
    scale: '0..100',
    aliases: ['스토캐스틱', '스토케스틱', 'stochastic'],
    description: { ko: '구간 내 종가 위치 (0~100)', en: 'Where the close sits in the range' },
  },
  STOCH_RSI: {
    name: 'Stochastic RSI', short: 'StochRSI', category: 'momentum', pane: 'own',
    params: [
      p('rsiPeriod', 14, 2, 500), p('stochPeriod', 14, 1, 500),
      p('smoothK', 3, 1, 100), p('smoothD', 3, 1, 100),
    ],
    outputs: [
      { key: 'k', label: '%K' },
      { key: 'd', label: '%D', color: '#f0b429' },
    ],
    compute: (c, x) =>
      stochasticRsi(closesOf(c), x.rsiPeriod ?? 14, x.stochPeriod ?? 14, x.smoothK ?? 3, x.smoothD ?? 3),
    guides: [20, 80],
    scale: '0..100',
    aliases: ['스토캐스틱rsi', '스토캐스틱 rsi', 'stochastic rsi', 'stochrsi'],
    description: { ko: 'RSI에 스토캐스틱 적용', en: 'Stochastic applied to RSI' },
  },
  CCI: {
    name: 'Commodity Channel Index', short: 'CCI', category: 'momentum', pane: 'own',
    params: [p('period', 20, 2, 1000)],
    outputs: [{ key: 'cci', label: 'CCI' }],
    compute: (c, x) => ({ cci: cci(c, x.period ?? 20) }),
    guides: [-100, 0, 100],
    scale: 'unbounded, +-100 is the usual band',
    description: { ko: '평균 대비 이탈 정도', en: 'Deviation from the mean typical price' },
  },
  WILLIAMS_R: {
    name: "Williams %R", short: '%R', category: 'momentum', pane: 'own',
    params: [p('period', 14, 1, 500)],
    outputs: [{ key: 'r', label: '%R' }],
    compute: (c, x) => ({ r: williamsR(c, x.period ?? 14) }),
    guides: [-80, -20],
    scale: '-100..0',
    aliases: ['윌리엄스', 'williams %r', 'williams r'],
    description: { ko: '스토캐스틱의 역상 (−100~0)', en: 'Stochastic mirrored onto -100..0' },
  },
  ROC: {
    name: 'Rate of Change', short: 'ROC', category: 'momentum', pane: 'own',
    params: [p('period', 12, 1, 1000)],
    outputs: [{ key: 'roc', label: 'ROC' }],
    compute: (c, x) => ({ roc: roc(closesOf(c), x.period ?? 12) }),
    guides: [0],
    scale: 'percent',
    aliases: ['변화율', 'rate of change'],
    description: { ko: '변화율 (%)', en: 'Percentage rate of change' },
  },
  MOMENTUM: {
    name: 'Momentum', short: 'MOM', category: 'momentum', pane: 'own',
    params: [p('period', 10, 1, 1000)],
    outputs: [{ key: 'momentum', label: 'MOM' }],
    compute: (c, x) => ({ momentum: momentum(closesOf(c), x.period ?? 10) }),
    guides: [0],
    scale: 'in price units',
    aliases: ['모멘텀'],
    description: { ko: 'N봉 전 대비 절대 변화', en: 'Absolute change against N bars ago' },
  },
  TRIX: {
    name: 'TRIX', short: 'TRIX', category: 'momentum', pane: 'own',
    params: [p('period', 15, 1, 500)],
    outputs: [{ key: 'trix', label: 'TRIX' }],
    compute: (c, x) => ({ trix: trix(closesOf(c), x.period ?? 15) }),
    guides: [0],
    scale: 'percent',
    description: { ko: '삼중 평활 EMA의 변화율', en: 'Rate of change of a triple-smoothed EMA' },
  },
  PPO: {
    name: 'Percentage Price Oscillator', short: 'PPO', category: 'momentum', pane: 'own',
    params: [p('fast', 12, 1, 500), p('slow', 26, 2, 1000), p('signal', 9, 1, 500)],
    outputs: [
      { key: 'histogram', label: 'histogram', style: 'histogram' },
      { key: 'ppo', label: 'PPO' },
      { key: 'signal', label: 'signal', color: '#f0b429' },
    ],
    compute: (c, x) => ppo(closesOf(c), x.fast ?? 12, x.slow ?? 26, x.signal ?? 9),
    guides: [0],
    scale: 'percent',
    description: { ko: 'MACD를 백분율로', en: 'MACD expressed as a percentage' },
  },
  DPO: {
    name: 'Detrended Price Oscillator', short: 'DPO', category: 'momentum', pane: 'own',
    params: [p('period', 20, 2, 1000)],
    outputs: [{ key: 'dpo', label: 'DPO' }],
    compute: (c, x) => ({ dpo: dpo(closesOf(c), x.period ?? 20) }),
    guides: [0],
    description: { ko: '추세를 제거한 가격 진동', en: 'Price with the trend removed' },
  },
  AWESOME: {
    name: 'Awesome Oscillator', short: 'AO', category: 'momentum', pane: 'own',
    params: [p('fast', 5, 1, 500), p('slow', 34, 2, 1000)],
    outputs: [{ key: 'ao', label: 'AO', style: 'histogram' }],
    compute: (c, x) => ({ ao: awesomeOscillator(c, x.fast ?? 5, x.slow ?? 34) }),
    guides: [0],
    aliases: ['어썸', '오썸', 'awesome oscillator'],
    description: { ko: '중간가 기준 모멘텀 히스토그램', en: 'Median-price momentum histogram' },
  },
  ULTIMATE: {
    name: 'Ultimate Oscillator', short: 'UO', category: 'momentum', pane: 'own',
    params: [p('short', 7, 1, 200), p('medium', 14, 1, 400), p('long', 28, 1, 800)],
    outputs: [{ key: 'uo', label: 'UO' }],
    compute: (c, x) => ({ uo: ultimateOscillator(c, x.short ?? 7, x.medium ?? 14, x.long ?? 28) }),
    guides: [30, 70],
    scale: '0..100',
    aliases: ['얼티메이트', 'ultimate oscillator'],
    description: { ko: '세 기간을 혼합한 매수압력', en: 'Buying pressure blended over three windows' },
  },
  ADX: {
    name: 'ADX / DMI', short: 'ADX', category: 'trend', pane: 'own',
    params: [p('period', 14, 2, 500)],
    outputs: [
      { key: 'adx', label: 'ADX' },
      { key: 'plusDi', label: '+DI', color: '#26a69a' },
      { key: 'minusDi', label: '-DI', color: '#ef5350' },
    ],
    compute: (c, x) => adx(c, x.period ?? 14),
    guides: [20, 25],
    scale: '0..100',
    aliases: ['방향성지수', 'dmi'],
    description: { ko: '추세 강도와 방향', en: 'Trend strength and direction' },
  },
  AROON: {
    name: 'Aroon', short: 'Aroon', category: 'trend', pane: 'own',
    params: [p('period', 14, 1, 500)],
    outputs: [
      { key: 'up', label: 'up', color: '#26a69a' },
      { key: 'down', label: 'down', color: '#ef5350' },
    ],
    compute: (c, x) => aroon(c, x.period ?? 14),
    guides: [30, 70],
    scale: '0..100',
    aliases: ['아룬'],
    description: { ko: '고점·저점이 얼마나 최근인가', en: 'How recently the high and low occurred' },
  },
  VORTEX: {
    name: 'Vortex', short: 'VI', category: 'trend', pane: 'own',
    params: [p('period', 14, 2, 500)],
    outputs: [
      { key: 'plus', label: 'VI+', color: '#26a69a' },
      { key: 'minus', label: 'VI-', color: '#ef5350' },
    ],
    compute: (c, x) => vortex(c, x.period ?? 14),
    guides: [1],
    scale: 'around 0..2, 1 is neutral',
    aliases: ['볼텍스'],
    description: { ko: '상승·하락 움직임의 경합', en: 'Competing up and down movement' },
  },
  CHOPPINESS: {
    name: 'Choppiness Index', short: 'CHOP', category: 'volatility', pane: 'own',
    params: [p('period', 14, 2, 500)],
    outputs: [{ key: 'chop', label: 'CHOP' }],
    compute: (c, x) => ({ chop: choppiness(c, x.period ?? 14) }),
    guides: [38.2, 61.8],
    scale: '0..100',
    aliases: ['촙피니스', 'choppiness index'],
    description: { ko: '횡보 100 ↔ 추세 0', en: '100 means ranging, 0 means trending' },
  },
  ELDER_RAY: {
    name: 'Elder Ray', short: 'Elder', category: 'momentum', pane: 'own',
    params: [p('period', 13, 1, 500)],
    outputs: [
      { key: 'bull', label: 'bull', color: '#26a69a', style: 'histogram' },
      { key: 'bear', label: 'bear', color: '#ef5350', style: 'histogram' },
    ],
    compute: (c, x) => elderRay(c, x.period ?? 13),
    guides: [0],
    aliases: ['엘더', 'elder ray'],
    description: { ko: '고·저가가 EMA를 얼마나 벗어났나', en: 'How far the extremes reach past the EMA' },
  },

  /* ── volatility ───────────────────────────────────────────────────────── */
  ATR: {
    name: 'Average True Range', short: 'ATR', category: 'volatility', pane: 'own',
    params: [p('period', 14, 1, 500)],
    outputs: [{ key: 'atr', label: 'ATR' }],
    compute: (c, x) => ({ atr: atr(c, x.period ?? 14) }),
    scale: 'in price units',
    description: { ko: '평균 실질 변동폭', en: 'Average true range' },
  },
  NATR: {
    name: 'Normalized ATR', short: 'NATR', category: 'volatility', pane: 'own',
    params: [p('period', 14, 1, 500)],
    outputs: [{ key: 'natr', label: 'NATR' }],
    compute: (c, x) => ({ natr: normalizedAtr(c, x.period ?? 14) }),
    scale: 'percent',
    aliases: ['정규화 atr'],
    description: { ko: '가격 대비 ATR (%)', en: 'ATR as a percentage of price' },
  },
  VOLATILITY: {
    name: 'Volatility', short: 'Volatility', category: 'volatility', pane: 'own',
    params: [p('period', 20, 2, 500)],
    outputs: [{ key: 'volatility', label: 'σ' }],
    compute: (c, x) => ({ volatility: volatility(closesOf(c), x.period ?? 20) }),
    scale: 'fraction, 0.02 is 2% daily stdev',
    aliases: ['변동성'],
    description: { ko: '수익률 표준편차', en: 'Rolling stdev of returns' },
  },
  STDDEV: {
    name: 'Standard Deviation', short: 'StdDev', category: 'volatility', pane: 'own',
    params: [p('period', 20, 2, 500)],
    outputs: [{ key: 'stddev', label: 'σ' }],
    compute: (c, x) => ({ stddev: standardDeviation(closesOf(c), x.period ?? 20) }),
    scale: 'in price units',
    aliases: ['표준편차', 'standard deviation'],
    description: { ko: '종가의 표준편차', en: 'Rolling stdev of the close' },
  },
  BB_WIDTH: {
    name: 'Bollinger Band Width', short: 'BBW', category: 'volatility', pane: 'own',
    params: [p('period', 20, 2, 500), p('stdDev', 2, 0.1, 10)],
    outputs: [{ key: 'width', label: 'BBW' }],
    compute: (c, x) => ({ width: bollingerWidth(closesOf(c), x.period ?? 20, x.stdDev ?? 2) }),
    scale: 'percent of the basis, e.g. 4 means 4%',
    aliases: ['밴드폭', '볼린저 폭', 'band width'],
    description: { ko: '밴드 폭 — 스퀴즈 탐지', en: 'Band width — the squeeze measure' },
  },
  DRAWDOWN: {
    name: 'Drawdown', short: 'DD', category: 'volatility', pane: 'own',
    params: [],
    outputs: [{ key: 'drawdown', label: 'DD' }],
    compute: (c) => ({ drawdown: drawdown(closesOf(c)) }),
    guides: [0],
    scale: 'negative fraction, -0.2 is -20%',
    aliases: ['낙폭', '드로다운'],
    description: { ko: '고점 대비 하락률', en: 'Fall from the running peak' },
  },

  /* ── volume ───────────────────────────────────────────────────────────── */
  VOLUME_SMA: {
    name: 'Volume SMA', short: 'Vol SMA', category: 'volume', pane: 'volume',
    params: [p('period', 20, 1, 1000)],
    outputs: [{ key: 'volumeSma', label: 'Vol SMA' }],
    compute: (c, x) => ({ volumeSma: sma(c.map((k) => k.volume), x.period ?? 20) }),
    aliases: ['거래량 이동평균', '거래량 평균', 'volume sma', 'volume average'],
    description: { ko: '평균 거래량 오버레이', en: 'Average volume overlay' },
  },
  OBV: {
    name: 'On Balance Volume', short: 'OBV', category: 'volume', pane: 'own',
    params: [],
    outputs: [{ key: 'obv', label: 'OBV' }],
    compute: (c) => ({ obv: obv(c) }),
    aliases: ['온밸런스'],
    description: { ko: '방향으로 부호를 준 누적 거래량', en: 'Cumulative volume signed by direction' },
  },
  MFI: {
    name: 'Money Flow Index', short: 'MFI', category: 'volume', pane: 'own',
    params: [p('period', 14, 2, 500)],
    outputs: [{ key: 'mfi', label: 'MFI' }],
    compute: (c, x) => ({ mfi: mfi(c, x.period ?? 14) }),
    guides: [20, 80],
    scale: '0..100',
    aliases: ['자금흐름지수', 'money flow'],
    description: { ko: '거래량을 반영한 RSI', en: 'A volume-weighted RSI' },
  },
  CMF: {
    name: 'Chaikin Money Flow', short: 'CMF', category: 'volume', pane: 'own',
    params: [p('period', 20, 2, 500)],
    outputs: [{ key: 'cmf', label: 'CMF' }],
    compute: (c, x) => ({ cmf: cmf(c, x.period ?? 20) }),
    guides: [0],
    scale: '-1..1',
    aliases: ['차이킨 자금', 'chaikin money flow'],
    description: { ko: '자금 유입·유출 비율', en: 'Money flow volume over total volume' },
  },
  AD_LINE: {
    name: 'Accumulation / Distribution', short: 'A/D', category: 'volume', pane: 'own',
    params: [],
    outputs: [{ key: 'ad', label: 'A/D' }],
    compute: (c) => ({ ad: adLine(c) }),
    aliases: ['누적분산', 'accumulation distribution', 'a/d line'],
    description: { ko: '누적 자금 흐름', en: 'Cumulative money-flow volume' },
  },
  CHAIKIN_OSC: {
    name: 'Chaikin Oscillator', short: 'ChaikinOsc', category: 'volume', pane: 'own',
    params: [p('fast', 3, 1, 200), p('slow', 10, 2, 500)],
    outputs: [{ key: 'osc', label: 'Chaikin', style: 'histogram' }],
    compute: (c, x) => ({ osc: chaikinOscillator(c, x.fast ?? 3, x.slow ?? 10) }),
    guides: [0],
    aliases: ['차이킨 오실레이터', 'chaikin oscillator'],
    description: { ko: 'A/D선의 MACD', en: 'The MACD of the A/D line' },
  },
  FORCE_INDEX: {
    name: 'Force Index', short: 'Force', category: 'volume', pane: 'own',
    params: [p('period', 13, 1, 500)],
    outputs: [{ key: 'force', label: 'Force' }],
    compute: (c, x) => ({ force: forceIndex(c, x.period ?? 13) }),
    guides: [0],
    aliases: ['강도지수', 'force index'],
    description: { ko: '가격 변화 × 거래량', en: 'Price change scaled by volume' },
  },
  EOM: {
    name: 'Ease of Movement', short: 'EOM', category: 'volume', pane: 'own',
    params: [p('period', 14, 1, 500)],
    outputs: [{ key: 'eom', label: 'EOM' }],
    compute: (c, x) => ({ eom: easeOfMovement(c, x.period ?? 14) }),
    guides: [0],
    aliases: ['이동용이성', 'ease of movement'],
    description: { ko: '거래량 대비 가격 이동 효율', en: 'Price movement per unit of volume' },
  },
  VOLUME_OSC: {
    name: 'Volume Oscillator', short: 'VolOsc', category: 'volume', pane: 'own',
    params: [p('fast', 5, 1, 200), p('slow', 20, 2, 500)],
    outputs: [{ key: 'osc', label: 'VolOsc' }],
    compute: (c, x) => ({ osc: volumeOscillator(c, x.fast ?? 5, x.slow ?? 20) }),
    guides: [0],
    scale: 'percent',
    aliases: ['거래량 오실레이터', 'volume oscillator'],
    description: { ko: '두 거래량 평균의 괴리(%)', en: 'Percentage gap between two volume averages' },
  },
} as const satisfies Record<string, IndicatorSpec>

export type IndicatorType = keyof typeof INDICATOR_REGISTRY

export const INDICATOR_TYPES = Object.keys(INDICATOR_REGISTRY) as [IndicatorType, ...IndicatorType[]]

/**
 * The registry as a plain list. `as const` narrows each entry to its own literal
 * type, which makes optional fields unreachable when iterating — this widens
 * them back to `IndicatorSpec` once, instead of casting at every call site.
 */
export const INDICATOR_LIST: Array<{ type: IndicatorType; spec: IndicatorSpec }> = (
  Object.entries(INDICATOR_REGISTRY) as Array<[IndicatorType, IndicatorSpec]>
).map(([type, spec]) => ({ type, spec }))

export function indicatorSpec(type: IndicatorType): IndicatorSpec {
  return INDICATOR_REGISTRY[type]
}

/** Fills in every default the spec declares, dropping unknown keys. */
export function resolveParams(
  type: IndicatorType,
  params: Record<string, unknown> = {},
): Record<string, number> {
  const spec = indicatorSpec(type)
  const resolved: Record<string, number> = {}
  for (const param of spec.params) {
    const provided = params[param.key]
    const value = typeof provided === 'number' && Number.isFinite(provided) ? provided : param.default
    // Clamp: an out-of-range period would either hang the loop or plot nothing.
    resolved[param.key] = Math.min(param.max ?? Infinity, Math.max(param.min ?? -Infinity, value))
  }
  return resolved
}

/** Runs an indicator and returns its named output series. */
export function computeIndicator(
  type: IndicatorType,
  candles: Candle[],
  params: Record<string, unknown> = {},
): Record<string, Series> {
  return indicatorSpec(type).compute(candles, resolveParams(type, params))
}
