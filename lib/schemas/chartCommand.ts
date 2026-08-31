import { z } from 'zod'
import { TIMEFRAMES } from '@/lib/types'
import { ConditionSchema } from './expression'

export const INDICATOR_TYPES = [
  'SMA',
  'EMA',
  'RSI',
  'MACD',
  'BOLLINGER',
  'ATR',
  'VOLUME_SMA',
] as const
export type IndicatorType = (typeof INDICATOR_TYPES)[number]

export const IndicatorParamsSchema = z
  .object({
    period: z.number().int().positive().max(1000).optional(),
    fast: z.number().int().positive().max(1000).optional(),
    slow: z.number().int().positive().max(1000).optional(),
    signal: z.number().int().positive().max(1000).optional(),
    stdDev: z.number().positive().max(10).optional(),
    source: z.enum(['OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOLUME']).optional(),
  })
  .strict()
export type IndicatorParams = z.infer<typeof IndicatorParamsSchema>

/**
 * A date reference: an ISO date (`2024-01-01`), `now`, or a relative offset
 * such as `-1y`, `-6M`, `-30d`, `-2w`.
 */
const DateRef = z.string().min(1).max(40)

const RangeSchema = z.object({ from: DateRef.optional(), to: DateRef.optional() })

const marker = z.object({
  color: z.string().max(32).optional(),
  position: z.enum(['aboveBar', 'belowBar']).optional(),
  shape: z.enum(['circle', 'square', 'arrowUp', 'arrowDown']).optional(),
})

export const ChartCommandSchema = z.union([
  z.object({ type: z.literal('SET_SYMBOL'), symbol: z.string().min(1).max(20) }),
  z.object({ type: z.literal('SET_TIMEFRAME'), timeframe: z.enum(TIMEFRAMES) }),
  z.object({
    type: z.literal('ADD_INDICATOR'),
    indicator: z.enum(INDICATOR_TYPES),
    params: IndicatorParamsSchema.optional(),
  }),
  z.object({
    type: z.literal('REMOVE_INDICATOR'),
    indicator: z.enum(INDICATOR_TYPES),
    params: IndicatorParamsSchema.optional(),
  }),
  z.object({
    type: z.literal('UPDATE_INDICATOR'),
    indicator: z.enum(INDICATOR_TYPES),
    params: IndicatorParamsSchema,
  }),
  z.object({
    type: z.literal('CREATE_SIGNAL'),
    name: z.string().min(1).max(60),
    condition: ConditionSchema,
    range: RangeSchema.optional(),
    visualization: marker.optional(),
  }),
  z.object({
    type: z.literal('UPDATE_SIGNAL'),
    /** Omit to target the most recently created signal. */
    name: z.string().max(60).optional(),
    condition: ConditionSchema.optional(),
    range: RangeSchema.optional(),
    visualization: marker.optional(),
  }),
  z.object({ type: z.literal('REMOVE_SIGNAL'), name: z.string().max(60).optional() }),
  z.object({
    type: z.literal('HIGHLIGHT_RANGE'),
    from: DateRef,
    to: DateRef,
    label: z.string().max(60).optional(),
    color: z.string().max(32).optional(),
  }),
  z.object({
    type: z.literal('ADD_PRICE_LINE'),
    price: z.number(),
    label: z.string().max(60).optional(),
    color: z.string().max(32).optional(),
  }),
  z.object({ type: z.literal('ZOOM_RANGE'), from: DateRef, to: DateRef.optional() }),
  z.object({
    type: z.literal('CLEAR_ANNOTATIONS'),
    scope: z.enum(['all', 'signals', 'lines', 'highlights', 'indicators']).optional(),
  }),
  z.object({
    type: z.literal('FIND_SUPPORT_RESISTANCE'),
    range: RangeSchema.optional(),
    maxLevels: z.number().int().positive().max(12).optional(),
  }),
])

export type ChartCommand = z.infer<typeof ChartCommandSchema>
export type ChartCommandType = ChartCommand['type']

export const AiResponseSchema = z.object({
  reply: z.string().max(2000),
  commands: z.array(ChartCommandSchema).max(12).default([]),
})
export type AiResponse = z.infer<typeof AiResponseSchema>
