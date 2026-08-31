import { z } from 'zod'
import { PRICE_SOURCES } from './priceSource'

const num = z.number().positive().max(10_000).optional()

/**
 * Every numeric knob the indicator registry declares, plus the price source.
 * Ranges are enforced again by `resolveParams`, which clamps rather than rejects.
 * Lives on its own so both the command schema and the expression schema can use
 * it without importing each other.
 */
export const IndicatorParamsSchema = z
  .object({
    source: z.enum(PRICE_SOURCES).optional(),
    period: num,
    fast: num,
    slow: num,
    signal: num,
    stdDev: num,
    multiplier: num,
    atrPeriod: num,
    smoothK: num,
    smoothD: num,
    stochPeriod: num,
    rsiPeriod: num,
    conversion: num,
    base: num,
    span: num,
    step: num,
    maxStep: num,
    short: num,
    medium: num,
    long: num,
  })
  .strict()

export type IndicatorParams = z.infer<typeof IndicatorParamsSchema>
