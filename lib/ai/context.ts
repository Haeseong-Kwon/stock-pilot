import { z } from 'zod'
import { TIMEFRAMES, type Candle, type Timeframe } from '@/lib/types'
import { LOCALES } from '@/lib/i18n/messages'
import { ConditionSchema, type Condition } from '@/lib/schemas/expression'
import { INDICATOR_TYPES, IndicatorParamsSchema, type IndicatorParams, type IndicatorType } from '@/lib/schemas/chartCommand'
import { formatDate } from '@/lib/format'

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
  /** Drawings already on the chart, so the model does not re-issue them. */
  drawings: z.array(z.enum(['trendline', 'fibonacci', 'channel', 'verticalLine'])).max(8).default([]),
})
export type ChartContext = z.infer<typeof ChartContextSchema>

export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
        /**
         * What that assistant turn actually ran. Sending every past turn with an
         * empty command list taught the model to answer with none of its own.
         */
        commands: z.array(z.unknown()).max(12).optional(),
      }),
    )
    .min(1)
    .max(20),
  context: ChartContextSchema,
  /** Drives both the reply language and the demo-mode parser's wording. */
  locale: z.enum(LOCALES).default('ko'),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const MAX_CONTEXT_INDICATORS = 20
export const MAX_CONTEXT_SIGNALS = 10

type ContextInput = {
  symbol: string
  timeframe: Timeframe
  candles: Candle[]
  indicators: Array<{ type: IndicatorType; params: IndicatorParams }>
  signals: Array<{ name: string; condition: Condition }>
  drawings?: ChartContext['drawings']
}

/**
 * Builds the snapshot sent with a chat request. Keeps only the most recent
 * indicators and signals: the schema caps them, and a follow-up like
 * "narrow that one" always refers to the latest signal anyway.
 */
export function buildChartContext({
  symbol,
  timeframe,
  candles,
  indicators,
  signals,
  drawings = [],
}: ContextInput): ChartContext {
  const first = candles[0]
  const last = candles[candles.length - 1]
  return {
    symbol,
    timeframe,
    barCount: candles.length,
    ...(first ? { firstBarDate: formatDate(first.time) } : {}),
    ...(last ? { lastBarDate: formatDate(last.time), lastPrice: last.close } : {}),
    indicators: indicators.slice(-MAX_CONTEXT_INDICATORS),
    signals: signals.slice(-MAX_CONTEXT_SIGNALS),
    drawings: [...new Set(drawings)],
  }
}
