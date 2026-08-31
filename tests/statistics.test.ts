import { describe, expect, it } from 'vitest'
import { returns } from '@/lib/analysis/statistics/returns'
import { volatility } from '@/lib/analysis/statistics/volatility'
import { drawdown, maxDrawdown } from '@/lib/analysis/statistics/drawdown'
import { zscore } from '@/lib/analysis/statistics/zscore'

describe('returns', () => {
  it('reports fractional change, not percent', () => {
    expect(returns([100, 95])[1]).toBeCloseTo(-0.05, 10)
  })

  it('supports multi-bar lookback', () => {
    expect(returns([100, 110, 120], 2)[2]).toBeCloseTo(0.2, 10)
  })
})

describe('drawdown', () => {
  it('is zero while making new highs', () => {
    expect(drawdown([1, 2, 3]).at(-1)).toBe(0)
  })

  it('measures the fall from the running peak', () => {
    expect(drawdown([100, 120, 60]).at(-1)).toBeCloseTo(-0.5, 10)
    expect(maxDrawdown([100, 120, 60])).toBeCloseTo(-0.5, 10)
  })
})

describe('volatility', () => {
  it('is zero on a perfectly flat series', () => {
    expect(volatility(new Array(40).fill(10), 20).at(-1)).toBeCloseTo(0, 12)
  })

  it('grows with the size of the swings', () => {
    const calm = volatility(Array.from({ length: 60 }, (_, i) => 100 + (i % 2)), 20).at(-1)!
    const wild = volatility(Array.from({ length: 60 }, (_, i) => 100 + (i % 2) * 20), 20).at(-1)!
    expect(wild).toBeGreaterThan(calm)
  })
})

describe('zscore', () => {
  it('is zero at the window mean', () => {
    expect(zscore([1, 2, 3, 2, 1, 2], 5).at(-1)).toBeCloseTo(0, 10)
  })

  it('is null when the window has no spread', () => {
    expect(zscore(new Array(10).fill(5), 5).at(-1)).toBeNull()
  })
})
