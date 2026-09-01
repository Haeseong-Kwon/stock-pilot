import { z } from 'zod'
import { TIMEFRAMES } from '@/lib/types'
import { INDICATOR_TYPES as REGISTRY_TYPES } from '@/lib/analysis/indicators/registry'
import { ConditionSchema } from './expression'
import { IndicatorParamsSchema as SharedIndicatorParams } from './indicatorParams'

export { INDICATOR_TYPES } from '@/lib/analysis/indicators/registry'
export type { IndicatorType } from '@/lib/analysis/indicators/registry'

export { IndicatorParamsSchema } from './indicatorParams'
export type { IndicatorParams } from './indicatorParams'

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
    indicator: z.enum(REGISTRY_TYPES),
    params: SharedIndicatorParams.optional(),
  }),
  z.object({
    type: z.literal('REMOVE_INDICATOR'),
    indicator: z.enum(REGISTRY_TYPES),
    params: SharedIndicatorParams.optional(),
  }),
  z.object({
    type: z.literal('UPDATE_INDICATOR'),
    indicator: z.enum(REGISTRY_TYPES),
    params: SharedIndicatorParams,
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
  // Drawing commands carry intent only. The anchors are computed from the
  // candles, because the model cannot see prices and must not invent them.
  z.object({
    type: z.literal('DRAW_TRENDLINE'),
    kind: z.enum(['support', 'resistance', 'both']).optional(),
    range: RangeSchema.optional(),
    maxLines: z.number().int().positive().max(4).optional(),
  }),
  z.object({
    type: z.literal('DRAW_FIBONACCI'),
    range: RangeSchema.optional(),
    /** Adds the 1.272 and 1.618 projections beyond the swing. */
    extend: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('DRAW_REGRESSION_CHANNEL'),
    range: RangeSchema.optional(),
    deviations: z.number().positive().max(5).optional(),
  }),
  z.object({
    type: z.literal('ADD_VERTICAL_LINE'),
    date: DateRef,
    label: z.string().max(60).optional(),
    color: z.string().max(32).optional(),
  }),
])

export type ChartCommand = z.infer<typeof ChartCommandSchema>
export type ChartCommandType = ChartCommand['type']

/**
 * The envelope only. Commands are validated one by one so a single malformed
 * command cannot discard the valid ones alongside it.
 */
export const AiEnvelopeSchema = z.object({
  reply: z.string().max(2000),
  commands: z.array(z.unknown()).max(12).default([]),
})

export const AiResponseSchema = z.object({
  reply: z.string().max(2000),
  commands: z.array(ChartCommandSchema).max(12).default([]),
})
export type AiResponse = z.infer<typeof AiResponseSchema>
