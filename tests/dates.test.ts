import { describe, expect, it } from 'vitest'
import { resolveDateRef, resolveRange } from '@/lib/dates'

const NOW = Date.UTC(2025, 0, 1)

describe('resolveDateRef', () => {
  it('parses an ISO date as UTC midnight', () => {
    expect(resolveDateRef('2024-03-15', NOW)).toBe(Date.UTC(2024, 2, 15) / 1000)
  })

  it('treats a bare offset as "ago"', () => {
    expect(resolveDateRef('1y', NOW)).toBeLessThan(NOW / 1000)
    expect(resolveDateRef('-1y', NOW)).toBe(resolveDateRef('1y', NOW))
  })

  it('supports an explicit forward offset', () => {
    expect(resolveDateRef('+30d', NOW)!).toBeGreaterThan(NOW / 1000)
  })

  it('resolves now', () => {
    expect(resolveDateRef('now', NOW)).toBe(NOW / 1000)
  })

  it('returns null for nonsense', () => {
    expect(resolveDateRef('sometime soon', NOW)).toBeNull()
  })
})

describe('resolveRange', () => {
  it('drops unparseable halves rather than failing outright', () => {
    expect(resolveRange({ from: '-6M', to: 'whenever' }, NOW)).toEqual({
      from: resolveDateRef('-6M', NOW),
    })
  })

  it('is undefined when nothing resolves', () => {
    expect(resolveRange({ from: 'nope' }, NOW)).toBeUndefined()
    expect(resolveRange(undefined, NOW)).toBeUndefined()
  })
})
