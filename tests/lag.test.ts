import { describe, expect, it } from 'vitest'
import type { Candle } from '@/lib/types'
import type { Condition } from '@/lib/schemas/expression'
import { ExpressionSchema } from '@/lib/schemas/expression'
import { evaluateExpression, evaluateSignal } from '@/lib/analysis/signals'
import { describeCondition } from '@/lib/chart/describe'
import { parseLocally } from '@/lib/ai/localParser'
import type { ChartContext } from '@/lib/ai/context'

const DAY = 86400
const START = Date.UTC(2024, 0, 1) / 1000

const from = (closes: number[]): Candle[] =>
  closes.map((close, i) => ({
    time: START + i * DAY,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000_000,
  }))

describe('LAG expression', () => {
  const candles = from([10, 20, 30, 40])

  it('shifts a series back by the given number of bars', () => {
    expect(evaluateExpression(candles, { type: 'LAG', value: { type: 'CLOSE' }, bars: 1 })).toEqual([
      null,
      10,
      20,
      30,
    ])
  })

  it('is null until enough history exists', () => {
    const result = evaluateExpression(candles, { type: 'LAG', value: { type: 'CLOSE' }, bars: 3 })
    expect(result.slice(0, 3)).toEqual([null, null, null])
    expect(result[3]).toBe(10)
  })

  it('nests, so LAG(LAG(x,1),1) equals LAG(x,2)', () => {
    const once = { type: 'LAG' as const, value: { type: 'CLOSE' as const }, bars: 1 }
    expect(evaluateExpression(candles, { type: 'LAG', value: once, bars: 1 })).toEqual(
      evaluateExpression(candles, { type: 'LAG', value: { type: 'CLOSE' }, bars: 2 }),
    )
  })

  it('validates and rejects a non-positive lag', () => {
    expect(ExpressionSchema.safeParse({ type: 'LAG', value: { type: 'CLOSE' }, bars: 2 }).success).toBe(true)
    expect(ExpressionSchema.safeParse({ type: 'LAG', value: { type: 'CLOSE' }, bars: 0 }).success).toBe(false)
  })

  it('renders readably', () => {
    expect(
      describeCondition({
        type: 'COMPARE',
        left: { type: 'LAG', value: { type: 'RETURN', period: 1 }, bars: 2 },
        operator: '<',
        right: 0,
      }),
    ).toBe('Daily return[-2] < 0%')
  })
})

describe('N consecutive down days', () => {
  // down, down, down, up  -> only index 3 has three falls behind it
  const candles = from([100, 99, 98, 97, 99])
  const threeDown: Condition = {
    type: 'AND',
    conditions: [
      { type: 'COMPARE', left: { type: 'RETURN', period: 1 }, operator: '<', right: 0 },
      { type: 'COMPARE', left: { type: 'LAG', value: { type: 'RETURN', period: 1 }, bars: 1 }, operator: '<', right: 0 },
      { type: 'COMPARE', left: { type: 'LAG', value: { type: 'RETURN', period: 1 }, bars: 2 }, operator: '<', right: 0 },
    ],
  }

  it('fires only on the bar that completes the streak', () => {
    const matches = evaluateSignal(candles, threeDown)
    expect(matches.map((m) => m.index)).toEqual([3])
  })

  it('is stricter than the multi-bar-return approximation it replaces', () => {
    // Down, up, down: net lower over 1, 2 and 3 bars, but not three falls in a row.
    const notAStreak = from([100, 95, 96, 94])
    const approximation: Condition = {
      type: 'AND',
      conditions: [1, 2, 3].map((period) => ({
        type: 'COMPARE' as const,
        left: { type: 'RETURN' as const, period },
        operator: '<' as const,
        right: 0,
      })),
    }
    expect(evaluateSignal(notAStreak, approximation).map((m) => m.index)).toEqual([3])
    expect(evaluateSignal(notAStreak, threeDown)).toEqual([])
  })
})

describe('demo parser understands streaks', () => {
  const context: ChartContext = {
    symbol: 'BTCUSDT',
    timeframe: '1D',
    barCount: 500,
    indicators: [],
    signals: [],
  }

  it('builds one LAG clause per bar', () => {
    const [command] = parseLocally('3일 연속 하락한 구간 찾아줘', context, 'ko').commands
    expect(command?.type).toBe('CREATE_SIGNAL')
    const condition = (command as { condition: Condition }).condition
    expect(condition.type).toBe('AND')
    expect((condition as { conditions: Condition[] }).conditions).toHaveLength(3)
    // LAG must not lose the percentage formatting of the value it wraps.
    expect(describeCondition(condition)).toBe(
      'Daily return < 0% AND Daily return[-1] < 0% AND Daily return[-2] < 0%',
    )
  })

  it('handles the English phrasing and the up direction', () => {
    const [command] = parseLocally('mark 4 consecutive up days', context, 'en').commands
    const condition = (command as { condition: Condition }).condition
    expect((condition as { conditions: Condition[] }).conditions).toHaveLength(4)
    expect(describeCondition(condition)).toContain('Daily return > 0%')
  })

  it('ignores an implausible streak length', () => {
    expect(parseLocally('100일 연속 하락', context, 'ko').commands).toEqual([])
  })
})
