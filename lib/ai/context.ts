import { z } from 'zod'
import { TIMEFRAMES } from '@/lib/types'
import { LOCALES } from '@/lib/i18n/messages'
import { ConditionSchema } from '@/lib/schemas/expression'
import { INDICATOR_TYPES, IndicatorParamsSchema } from '@/lib/schemas/chartCommand'

/** The compact chart snapshot the model reasons over. Raw candles are never sent. */
export const ChartContextSchema = z.object({
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(TIMEFRAMES),
  barCount: z.number().int().nonnegative(),
  firstBarDate: z.string().max(32).optional(),
  lastBarDate: z.string().max(32).optional(),
  lastPrice: z.number().optional(),
  indicators: z
    .array(z.object({ type: z.enum(INDICATOR_TYPES), params: IndicatorParamsSchema }))
    .max(20)
    .default([]),
  signals: z
    .array(z.object({ name: z.string().max(60), condition: ConditionSchema }))
    .max(10)
    .default([]),
})
export type ChartContext = z.infer<typeof ChartContextSchema>

export const ChatRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
  context: ChartContextSchema,
  /** Drives both the reply language and the demo-mode parser's wording. */
  locale: z.enum(LOCALES).default('ko'),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>
