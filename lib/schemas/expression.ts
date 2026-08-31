import { z } from 'zod'

export const PRICE_SOURCES = ['OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOLUME'] as const
export type PriceSource = (typeof PRICE_SOURCES)[number]

export const COMPARE_OPERATORS = ['>', '>=', '<', '<=', '==', '!='] as const
export type CompareOperator = (typeof COMPARE_OPERATORS)[number]

export type Expression =
  | { type: PriceSource }
  | { type: 'NUMBER'; value: number }
  | { type: 'RETURN'; period?: number }
  | { type: 'SMA'; period: number; source?: PriceSource }
  | { type: 'EMA'; period: number; source?: PriceSource }
  | { type: 'RSI'; period?: number }
  | { type: 'MACD'; fast?: number; slow?: number; signal?: number; output?: 'macd' | 'signal' | 'histogram' }
  | { type: 'ATR'; period?: number }
  | { type: 'BOLLINGER'; period?: number; stdDev?: number; band: 'upper' | 'middle' | 'lower' }
  | { type: 'VOLUME_SMA'; period?: number }
  | { type: 'VOLATILITY'; period?: number }
  | { type: 'DRAWDOWN' }
  | { type: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE'; left: Operand; right: Operand }
  | { type: 'ABS'; value: Operand }
  /** The value this expression had `bars` bars ago. Null before that. */
  | { type: 'LAG'; value: Operand; bars: number }

/** Anywhere an expression is accepted, a bare number is too. */
export type Operand = Expression | number

export type Condition =
  | { type: 'AND'; conditions: Condition[] }
  | { type: 'OR'; conditions: Condition[] }
  | { type: 'NOT'; condition: Condition }
  | { type: 'COMPARE'; left: Operand; operator: CompareOperator; right: Operand }
  | { type: 'CROSS_ABOVE'; left: Operand; right: Operand }
  | { type: 'CROSS_BELOW'; left: Operand; right: Operand }

const priceSource = z.enum(PRICE_SOURCES)

export const OperandSchema: z.ZodType<Operand> = z.lazy(() =>
  z.union([z.number(), ExpressionSchema]),
)

export const ExpressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.union([
    z.object({ type: priceSource }),
    z.object({ type: z.literal('NUMBER'), value: z.number() }),
    z.object({ type: z.literal('RETURN'), period: z.number().int().positive().optional() }),
    z.object({
      type: z.literal('SMA'),
      period: z.number().int().positive(),
      source: priceSource.optional(),
    }),
    z.object({
      type: z.literal('EMA'),
      period: z.number().int().positive(),
      source: priceSource.optional(),
    }),
    z.object({ type: z.literal('RSI'), period: z.number().int().positive().optional() }),
    z.object({
      type: z.literal('MACD'),
      fast: z.number().int().positive().optional(),
      slow: z.number().int().positive().optional(),
      signal: z.number().int().positive().optional(),
      output: z.enum(['macd', 'signal', 'histogram']).optional(),
    }),
    z.object({ type: z.literal('ATR'), period: z.number().int().positive().optional() }),
    z.object({
      type: z.literal('BOLLINGER'),
      period: z.number().int().positive().optional(),
      stdDev: z.number().positive().optional(),
      band: z.enum(['upper', 'middle', 'lower']),
    }),
    z.object({ type: z.literal('VOLUME_SMA'), period: z.number().int().positive().optional() }),
    z.object({ type: z.literal('VOLATILITY'), period: z.number().int().positive().optional() }),
    z.object({ type: z.literal('DRAWDOWN') }),
    z.object({
      type: z.enum(['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE']),
      left: OperandSchema,
      right: OperandSchema,
    }),
    z.object({ type: z.literal('ABS'), value: OperandSchema }),
    z.object({
      type: z.literal('LAG'),
      value: OperandSchema,
      bars: z.number().int().positive().max(500),
    }),
  ]),
)

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('AND'), conditions: z.array(ConditionSchema).min(1) }),
    z.object({ type: z.literal('OR'), conditions: z.array(ConditionSchema).min(1) }),
    z.object({ type: z.literal('NOT'), condition: ConditionSchema }),
    z.object({
      type: z.literal('COMPARE'),
      left: OperandSchema,
      operator: z.enum(COMPARE_OPERATORS),
      right: OperandSchema,
    }),
    z.object({ type: z.literal('CROSS_ABOVE'), left: OperandSchema, right: OperandSchema }),
    z.object({ type: z.literal('CROSS_BELOW'), left: OperandSchema, right: OperandSchema }),
  ]),
)
