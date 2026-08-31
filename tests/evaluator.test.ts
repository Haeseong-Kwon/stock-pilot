import { describe, expect, it } from 'vitest'
import type { Candle } from '@/lib/types'
import { ConditionSchema } from '@/lib/schemas/expression'
import { crossAbove, crossBelow, evaluateCondition, evaluateExpression, evaluateSignal, findSupportResistance } from '@/lib/analysis/signals'

const DAY = 86400
const START = Date.UTC(2024, 0, 1) / 1000

function build(rows: Array<{ close: number; volume?: number }>): Candle[] {
  return rows.map((row, i) => ({
    time: START + i * DAY,
    open: row.close,
    high: row.close * 1.01,
    low: row.close * 0.99,
    close: row.close,
    volume: row.volume ?? 1_000_000,
  }))
}

describe('crossovers', () => {
  it('fires exactly on the bar where the lines swap order', () => {
    const a = [1, 2, 3, 4]
    const b = [4, 3, 2, 1]
    expect(crossAbove(a, b)).toEqual([null, false, true, false])
    expect(crossBelow(a, b)).toEqual([null, false, false, false])
  })

  it('is symmetric for the opposite direction', () => {
    expect(crossBelow([4, 3, 2], [1, 2, 3])).toEqual([null, false, true])
  })

  it('never fires on the first bar', () => {
    expect(crossAbove([0, 5], [1, 1])[0]).toBeNull()
  })
})

describe('evaluateExpression', () => {
  const candles = build([{ close: 100 }, { close: 95 }, { close: 105 }])

  it('reads raw price sources', () => {
    expect(evaluateExpression(candles, { type: 'CLOSE' })).toEqual([100, 95, 105])
  })

  it('computes derived returns as fractions', () => {
    expect(evaluateExpression(candles, { type: 'RETURN', period: 1 })[1]).toBeCloseTo(-0.05, 10)
  })

  it('supports arithmetic against a bare number', () => {
    const result = evaluateExpression(candles, {
      type: 'MULTIPLY',
      left: { type: 'CLOSE' },
      right: 2,
    })
    expect(result).toEqual([200, 190, 210])
  })
})

describe('evaluateCondition', () => {
  const candles = build([
    { close: 100, volume: 1_000_000 },
    { close: 93, volume: 9_000_000 },
    { close: 92, volume: 1_000_000 },
  ])

  it('compares an expression against a literal', () => {
    const hits = evaluateCondition(candles, {
      type: 'COMPARE',
      left: { type: 'RETURN', period: 1 },
      operator: '<=',
      right: -0.05,
    })
    expect(hits).toEqual([null, true, false])
  })

  it('requires every branch of an AND', () => {
    const hits = evaluateCondition(candles, {
      type: 'AND',
      conditions: [
        { type: 'COMPARE', left: { type: 'RETURN', period: 1 }, operator: '<=', right: -0.05 },
        { type: 'COMPARE', left: { type: 'VOLUME' }, operator: '>=', right: 5_000_000 },
      ],
    })
    expect(hits[1]).toBe(true)
    expect(hits[2]).toBe(false)
  })

  it('inverts with NOT and keeps nulls null', () => {
    const inner = { type: 'COMPARE' as const, left: { type: 'CLOSE' as const }, operator: '>' as const, right: 99 }
    expect(evaluateCondition(candles, { type: 'NOT', condition: inner })).toEqual([false, true, true])
  })
})

describe('evaluateSignal', () => {
  // 300 flat bars, then one -8% day on 12x volume.
  const rows = Array.from({ length: 300 }, () => ({ close: 100, volume: 1_000_000 }))
  rows.push({ close: 92, volume: 12_000_000 })
  rows.push({ close: 92.5, volume: 1_000_000 })
  const candles = build(rows)

  const dropCondition = {
    type: 'COMPARE' as const,
    left: { type: 'RETURN' as const, period: 1 },
    operator: '<=' as const,
    right: -0.05,
  }

  it('returns the matching bar with tooltip context', () => {
    const matches = evaluateSignal(candles, dropCondition)
    expect(matches).toHaveLength(1)
    expect(matches[0]!.index).toBe(300)
    expect(matches[0]!.change).toBeCloseTo(-0.08, 8)
    expect(matches[0]!.volumeRatio!).toBeGreaterThan(5)
  })

  it('narrows when a volume clause is ANDed in', () => {
    const compound = {
      type: 'AND' as const,
      conditions: [
        dropCondition,
        {
          type: 'COMPARE' as const,
          left: { type: 'VOLUME' as const },
          operator: '>=' as const,
          right: { type: 'MULTIPLY' as const, left: { type: 'VOLUME_SMA' as const, period: 20 }, right: 2 },
        },
      ],
    }
    expect(evaluateSignal(candles, compound)).toHaveLength(1)

    const impossible = {
      type: 'AND' as const,
      conditions: [
        dropCondition,
        { type: 'COMPARE' as const, left: { type: 'VOLUME' as const }, operator: '>=' as const, right: 1e12 },
      ],
    }
    expect(evaluateSignal(candles, impossible)).toEqual([])
  })

  it('honours a time window', () => {
    const outside = evaluateSignal(candles, dropCondition, { to: START })
    expect(outside).toEqual([])
  })

  it('is deterministic across runs', () => {
    expect(evaluateSignal(candles, dropCondition)).toEqual(evaluateSignal(candles, dropCondition))
  })
})

describe('ConditionSchema', () => {
  it('accepts a nested compound condition', () => {
    const parsed = ConditionSchema.safeParse({
      type: 'AND',
      conditions: [
        { type: 'COMPARE', left: { type: 'RSI', period: 14 }, operator: '<=', right: 30 },
        {
          type: 'COMPARE',
          left: { type: 'VOLUME' },
          operator: '>=',
          right: { type: 'MULTIPLY', left: { type: 'VOLUME_SMA', period: 20 }, right: 2 },
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an unknown operator', () => {
    expect(
      ConditionSchema.safeParse({ type: 'COMPARE', left: { type: 'CLOSE' }, operator: '=~', right: 1 })
        .success,
    ).toBe(false)
  })

  it('rejects an unknown expression node', () => {
    expect(
      ConditionSchema.safeParse({
        type: 'COMPARE',
        left: { type: 'SECRET_ALPHA' },
        operator: '>',
        right: 1,
      }).success,
    ).toBe(false)
  })
})

describe('findSupportResistance', () => {
  it('finds the repeated level in a zig-zag series', () => {
    const rows: Array<{ close: number }> = []
    for (let i = 0; i < 12; i++) {
      rows.push({ close: 100 }, { close: 110 }, { close: 100 }, { close: 90 })
    }
    const levels = findSupportResistance(build(rows), { pivotWindow: 1, tolerance: 0.02 })
    expect(levels.length).toBeGreaterThan(0)
    expect(levels.every((l) => l.touches >= 2)).toBe(true)
    expect(levels[0]!.strength).toBeCloseTo(1, 6)
  })

  it('returns nothing when there is no history to work with', () => {
    expect(findSupportResistance(build([{ close: 1 }, { close: 2 }]))).toEqual([])
  })
})
