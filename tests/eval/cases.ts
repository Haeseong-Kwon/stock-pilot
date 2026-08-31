import type { ChartCommandType } from '@/lib/schemas/chartCommand'
import { CATALOGUE_ENTRIES } from '@/lib/ai/commandCatalogue'

export type EvalCase = {
  id: string
  prompt: string
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

export const EVAL_CASES: EvalCase[] = [...catalogue, ...hard]
