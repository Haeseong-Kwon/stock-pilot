import type { Candle, Series } from '@/lib/types'
import type { Condition, Expression, Operand, PriceSource } from '@/lib/schemas/expression'
import { atr, bollinger, ema, macd, rsi, sma } from '@/lib/analysis/indicators'
import { computeIndicator, indicatorSpec } from '@/lib/analysis/indicators/registry'
import { returns } from '@/lib/analysis/statistics/returns'
import { volatility } from '@/lib/analysis/statistics/volatility'
import { drawdown } from '@/lib/analysis/statistics/drawdown'
import { crossAbove, crossBelow } from './crossover'

export type BoolSeries = (boolean | null)[]

/** Per-evaluation memo so a compound condition computes SMA(20) only once. */
type Cache = Map<string, Series>

function priceSeries(candles: Candle[], source: PriceSource): Series {
  switch (source) {
    case 'OPEN':
      return candles.map((c) => c.open)
    case 'HIGH':
      return candles.map((c) => c.high)
    case 'LOW':
      return candles.map((c) => c.low)
    case 'VOLUME':
      return candles.map((c) => c.volume)
    case 'CLOSE':
    default:
      return candles.map((c) => c.close)
  }
}

function constant(length: number, value: number): Series {
  return new Array(length).fill(value)
}

export function evaluateOperand(candles: Candle[], operand: Operand, cache: Cache = new Map()): Series {
  if (typeof operand === 'number') return constant(candles.length, operand)
  return evaluateExpression(candles, operand, cache)
}

export function evaluateExpression(
  candles: Candle[],
  expr: Expression,
  cache: Cache = new Map(),
): Series {
  const key = JSON.stringify(expr)
  const hit = cache.get(key)
  if (hit) return hit
  const value = compute(candles, expr, cache)
  cache.set(key, value)
  return value
}

function compute(candles: Candle[], expr: Expression, cache: Cache): Series {
  const closes = priceSeries(candles, 'CLOSE')
  switch (expr.type) {
    case 'OPEN':
    case 'HIGH':
    case 'LOW':
    case 'CLOSE':
    case 'VOLUME':
      return priceSeries(candles, expr.type)
    case 'NUMBER':
      return constant(candles.length, expr.value)
    case 'RETURN':
      return returns(closes, expr.period ?? 1)
    case 'SMA':
      return sma(priceSeries(candles, expr.source ?? 'CLOSE'), expr.period)
    case 'EMA':
      return ema(priceSeries(candles, expr.source ?? 'CLOSE'), expr.period)
    case 'RSI':
      return rsi(closes, expr.period ?? 14)
    case 'MACD': {
      const result = macd(closes, expr.fast ?? 12, expr.slow ?? 26, expr.signal ?? 9)
      return result[expr.output ?? 'macd']
    }
    case 'ATR':
      return atr(candles, expr.period ?? 14)
    case 'BOLLINGER':
      return bollinger(closes, expr.period ?? 20, expr.stdDev ?? 2)[expr.band]
    case 'VOLUME_SMA':
      return sma(priceSeries(candles, 'VOLUME'), expr.period ?? 20)
    case 'VOLATILITY':
      return volatility(closes, expr.period ?? 20)
    case 'DRAWDOWN':
      return drawdown(closes)
    case 'ABS':
      return evaluateOperand(candles, expr.value, cache).map((v) => (v === null ? null : Math.abs(v)))
    case 'LAG': {
      const inner = evaluateOperand(candles, expr.value, cache)
      return inner.map((_, i) => (i >= expr.bars ? (inner[i - expr.bars] ?? null) : null))
    }
    case 'INDICATOR': {
      const spec = indicatorSpec(expr.name)
      const outputs = computeIndicator(expr.name, candles, expr.params ?? {})
      const key = expr.output ?? spec.outputs[0]?.key
      const series = key ? outputs[key] : undefined
      // An unknown output name must not silently read as another series.
      return series ?? new Array(candles.length).fill(null)
    }
    case 'ADD':
    case 'SUBTRACT':
    case 'MULTIPLY':
    case 'DIVIDE': {
      const left = evaluateOperand(candles, expr.left, cache)
      const right = evaluateOperand(candles, expr.right, cache)
      return left.map((l, i) => {
        const r = right[i]
        if (l === null || r === null || r === undefined) return null
        if (expr.type === 'ADD') return l + r
        if (expr.type === 'SUBTRACT') return l - r
        if (expr.type === 'MULTIPLY') return l * r
        return r === 0 ? null : l / r
      })
    }
  }
}

export function evaluateCondition(
  candles: Candle[],
  condition: Condition,
  cache: Cache = new Map(),
): BoolSeries {
  switch (condition.type) {
    case 'AND':
    case 'OR': {
      const parts = condition.conditions.map((c) => evaluateCondition(candles, c, cache))
      return candles.map((_, i) => {
        const values = parts.map((p) => p[i] ?? null)
        if (values.some((v) => v === null)) return null
        return condition.type === 'AND' ? values.every(Boolean) : values.some(Boolean)
      })
    }
    case 'NOT': {
      const inner = evaluateCondition(candles, condition.condition, cache)
      return inner.map((v) => (v === null || v === undefined ? null : !v))
    }
    case 'COMPARE': {
      const left = evaluateOperand(candles, condition.left, cache)
      const right = evaluateOperand(candles, condition.right, cache)
      return left.map((l, i) => {
        const r = right[i]
        if (l === null || r === null || r === undefined) return null
        switch (condition.operator) {
          case '>':
            return l > r
          case '>=':
            return l >= r
          case '<':
            return l < r
          case '<=':
            return l <= r
          case '==':
            return l === r
          case '!=':
            return l !== r
        }
      })
    }
    case 'CROSS_ABOVE':
    case 'CROSS_BELOW': {
      const left = evaluateOperand(candles, condition.left, cache)
      const right = evaluateOperand(candles, condition.right, cache)
      return condition.type === 'CROSS_ABOVE' ? crossAbove(left, right) : crossBelow(left, right)
    }
  }
}

export type SignalMatch = {
  index: number
  time: number
  price: number
  /** 1-bar return at the match, as a fraction. */
  change: number | null
  /** Volume relative to its own 20-bar average. */
  volumeRatio: number | null
  rsi: number | null
}

export type SignalRange = { from?: number; to?: number }

/** Runs a condition over the candles and returns the matching bars with tooltip context. */
export function evaluateSignal(
  candles: Candle[],
  condition: Condition,
  range?: SignalRange,
): SignalMatch[] {
  if (candles.length === 0) return []
  const cache: Cache = new Map()
  const hits = evaluateCondition(candles, condition, cache)
  const closes = candles.map((c) => c.close)
  const ret1 = returns(closes, 1)
  const volAvg = sma(candles.map((c) => c.volume), 20)
  const rsi14 = rsi(closes, 14)

  const matches: SignalMatch[] = []
  for (let i = 0; i < candles.length; i++) {
    if (hits[i] !== true) continue
    const candle = candles[i]
    if (!candle) continue
    if (range?.from !== undefined && candle.time < range.from) continue
    if (range?.to !== undefined && candle.time > range.to) continue
    const avg = volAvg[i]
    matches.push({
      index: i,
      time: candle.time,
      price: candle.close,
      change: ret1[i] ?? null,
      volumeRatio: avg && avg > 0 ? candle.volume / avg : null,
      rsi: rsi14[i] ?? null,
    })
  }
  return matches
}
