import type { ChartCommandType } from '@/lib/schemas/chartCommand'
import { CATALOGUE_ENTRIES } from '@/lib/ai/commandCatalogue'

export type EvalCase = {
  id: string
  prompt: string
  /**
   * Earlier turns to replay first. Multi-turn is where the model actually
   * breaks — it drops the JSON envelope, forgets state, or redraws what is
   * already there — and a single-shot suite never sees any of that.
   */
  priorTurns?: string[]
  /** What each prior turn ran, so the replayed history is realistic. */
  priorCommands?: unknown[]
  /** Drawings already on the chart when the case runs. */
  existingDrawings?: Array<'trendline' | 'fibonacci' | 'channel' | 'verticalLine'>
  /** Command types that must NOT appear (beyond `forbid`), by intent. */
  note?: string
  /** Command types the answer must contain. */
  expect: ChartCommandType[]
  /** Satisfied when any one of these groups is fully present. */
  expectOneOf?: ChartCommandType[][]
  /** Command types that must NOT appear. */
  forbid?: ChartCommandType[]
  /** Substrings that must appear in the serialized commands. */
  contains?: string[]
  /** True when the correct answer is to produce no command at all. */
  expectRefusal?: boolean
  /** The chart already has a signal, so follow-ups have something to refer to. */
  needsSignal?: boolean
  /** The chart already has SMA(20), so "change its period" has a target. */
  needsIndicator?: boolean
}

/** The 30 gallery prompts: each must still produce the command it advertises. */
const catalogue: EvalCase[] = CATALOGUE_ENTRIES.map((entry) => ({
  id: `catalogue:${entry.id}`,
  prompt: entry.prompt.ko,
  expect: [entry.produces],
  ...(entry.requires === 'signal' || entry.produces === 'REMOVE_SIGNAL' ? { needsSignal: true } : {}),
  // "remove the 20-day line" needs one on the chart to remove.
  ...(entry.produces === 'REMOVE_INDICATOR' ? { needsIndicator: true } : {}),
}))

/** The cases the rule-based parser could not express. These are the real bar. */
const hard: EvalCase[] = [
  {
    id: 'hard:sma-cross',
    prompt: '20일선이 60일선을 뚫고 올라간 지점만 표시해',
    expect: ['CREATE_SIGNAL'],
    contains: ['CROSS_ABOVE', '"period":20', '"period":60'],
  },
  {
    id: 'hard:streak',
    prompt: '3일 연속 하락한 구간 찾아줘',
    expect: ['CREATE_SIGNAL'],
    contains: ['LAG'],
  },
  {
    id: 'hard:rsi-reversal',
    prompt: 'RSI가 70 넘었다가 다시 60 아래로 내려온 날',
    expect: ['CREATE_SIGNAL'],
    contains: ['RSI'],
  },
  {
    id: 'hard:low-volume-rally',
    prompt: '거래량은 평균 이하인데 5% 넘게 오른 날',
    expect: ['CREATE_SIGNAL'],
    contains: ['VOLUME_SMA', '"operator":"<'],
  },
  {
    // Ranking periods is impossible without seeing prices. Adding the volatility
    // indicator and explaining is fine; inventing a date range never is.
    id: 'hard:superlative',
    prompt: '변동성이 가장 큰 달만 강조해줘',
    expect: [],
    forbid: ['HIGHLIGHT_RANGE', 'ZOOM_RANGE'],
  },
  {
    id: 'hard:drawdown',
    prompt: '최근 고점 대비 20% 이상 빠진 구간',
    expect: ['CREATE_SIGNAL'],
    contains: ['DRAWDOWN'],
  },
  {
    id: 'hard:macd-cross',
    prompt: 'MACD가 시그널선을 상향 돌파한 곳 표시',
    expect: ['CREATE_SIGNAL'],
    contains: ['CROSS_ABOVE', '"signal"'],
  },
  {
    id: 'hard:update-period',
    prompt: '20일선 기간을 60일로 바꿔줘',
    expect: [],
    // Replacing the indicator reaches the same chart state as updating it.
    expectOneOf: [['UPDATE_INDICATOR'], ['REMOVE_INDICATOR', 'ADD_INDICATOR']],
    contains: ['"period":60'],
    needsIndicator: true,
  },
]

/**
 * The cases a single-shot suite cannot reach: follow-ups, vague phrasing,
 * cross-indicator comparisons and requests that should be refused.
 */
const advanced: EvalCase[] = [
  {
    id: 'multi:narrow-twice',
    priorTurns: ['5% 이상 떨어진 날 표시해', '그중 거래량이 두 배 이상인 것만'],
    priorCommands: [
      { type: 'CREATE_SIGNAL', name: 'Drop ≥ 5%' },
      { type: 'UPDATE_SIGNAL', name: 'Drop ≥ 5%' },
    ],
    prompt: '거기서 RSI 40 아래인 것만 다시 남겨',
    expect: ['UPDATE_SIGNAL'],
    contains: ['AND', 'RSI'],
    needsSignal: true,
    note: 'Third-level narrowing must still edit in place, not create a signal',
  },
  {
    id: 'multi:no-redraw',
    priorTurns: ['추세선 그려줘'],
    priorCommands: [{ type: 'DRAW_TRENDLINE', kind: 'both' }],
    prompt: '피보나치도 그려줘',
    expect: ['DRAW_FIBONACCI'],
    forbid: ['DRAW_TRENDLINE'],
    existingDrawings: ['trendline'],
    note: 'Must not re-issue a drawing the context says is already there',
  },
  {
    id: 'multi:envelope-holds',
    priorTurns: ['RSI 추가해', 'MACD도 추가해', '볼린저도'],
    priorCommands: [
      { type: 'ADD_INDICATOR', indicator: 'RSI', params: { period: 14 } },
      { type: 'ADD_INDICATOR', indicator: 'MACD' },
      { type: 'ADD_INDICATOR', indicator: 'BOLLINGER' },
    ],
    prompt: 'ATR도 추가해',
    expect: ['ADD_INDICATOR'],
    contains: ['ATR'],
    note: 'Four turns in, the model must still answer with the JSON envelope',
  },
  {
    id: 'vague:something-useful',
    prompt: '이 종목 지금 흐름이 어떤지 볼 수 있게 뭐 좀 띄워줘',
    expect: [],
    forbid: ['HIGHLIGHT_RANGE', 'ZOOM_RANGE', 'SET_SYMBOL'],
    note: 'Vague but actionable: anything is fine except inventing a window',
  },
  {
    id: 'vague:overbought',
    prompt: '지금 너무 많이 오른 것 같은데 확인해줘',
    expect: [],
    forbid: ['HIGHLIGHT_RANGE', 'ZOOM_RANGE'],
  },
  {
    id: 'cross:di',
    prompt: '+DI가 -DI보다 큰 구간만 표시해',
    expect: ['CREATE_SIGNAL'],
    contains: ['plusDi', 'minusDi'],
    note: 'Comparing two outputs of the same indicator',
  },
  {
    id: 'cross:price-vs-band',
    prompt: '종가가 켈트너 채널 상단 위에 있는 날 표시',
    expect: ['CREATE_SIGNAL'],
    contains: ['KELTNER', 'upper'],
  },
  {
    id: 'cross:two-indicators',
    prompt: 'RSI가 MFI보다 높은 날 찾아줘',
    expect: ['CREATE_SIGNAL'],
    contains: ['RSI', 'MFI'],
  },
  {
    id: 'refuse:future',
    prompt: '다음 주에 오를지 알려줘',
    expect: [],
    forbid: ['CREATE_SIGNAL', 'HIGHLIGHT_RANGE', 'ZOOM_RANGE', 'ADD_PRICE_LINE'],
    note: 'A forecast is not a chart command; it must not fake one',
  },
  {
    id: 'refuse:best-month',
    prompt: '올해 가장 많이 오른 달이 언제야?',
    expect: [],
    forbid: ['HIGHLIGHT_RANGE', 'ZOOM_RANGE'],
    note: 'Ranking periods needs prices the model cannot see',
  },
  {
    id: 'patterns:find',
    prompt: '쌍바닥이나 헤드앤숄더 있는지 찾아줘',
    expect: ['FIND_PATTERNS'],
  },
  {
    id: 'drawing:trendline-window',
    prompt: '최근 3개월 추세선만 그려줘',
    expect: ['DRAW_TRENDLINE'],
    contains: ['-3M'],
    note: 'A named window must reach the command, not be dropped',
  },
]

export const EVAL_CASES: EvalCase[] = [...catalogue, ...hard, ...advanced]
