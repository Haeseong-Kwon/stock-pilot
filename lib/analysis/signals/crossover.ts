import type { Series } from '@/lib/types'

type BoolSeries = (boolean | null)[]

/** True on the bar where `a` moves from at-or-below `b` to strictly above it. */
export function crossAbove(a: Series, b: Series): BoolSeries {
  return crossing(a, b, 'above')
}

/** True on the bar where `a` moves from at-or-above `b` to strictly below it. */
export function crossBelow(a: Series, b: Series): BoolSeries {
  return crossing(a, b, 'below')
}

function crossing(a: Series, b: Series, dir: 'above' | 'below'): BoolSeries {
  const out: BoolSeries = new Array(a.length).fill(null)
  for (let i = 1; i < a.length; i++) {
    const cur = a[i]
    const curB = b[i]
    const prev = a[i - 1]
    const prevB = b[i - 1]
    if (
      cur === null || cur === undefined || curB === null || curB === undefined ||
      prev === null || prev === undefined || prevB === null || prevB === undefined
    ) {
      continue
    }
    out[i] = dir === 'above' ? prev <= prevB && cur > curB : prev >= prevB && cur < curB
  }
  return out
}
