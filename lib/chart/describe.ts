import type { Condition, Expression, Operand } from '@/lib/schemas/expression'
import { indicatorSpec } from '@/lib/analysis/indicators/registry'

const PERCENT_EXPRESSIONS = new Set(['RETURN', 'DRAWDOWN', 'VOLATILITY'])

/** LAG is transparent here: LAG(RETURN, 2) is still a percentage. */
function isPercentOperand(operand: Operand): boolean {
  if (typeof operand === 'number') return false
  if (operand.type === 'LAG') return isPercentOperand(operand.value)
  return PERCENT_EXPRESSIONS.has(operand.type)
}

function describeExpression(expr: Expression): string {
  switch (expr.type) {
    case 'OPEN':
    case 'HIGH':
    case 'LOW':
    case 'CLOSE':
    case 'VOLUME':
      return expr.type.charAt(0) + expr.type.slice(1).toLowerCase()
    case 'NUMBER':
      return String(expr.value)
    case 'RETURN':
      return expr.period && expr.period > 1 ? `${expr.period}-bar return` : 'Daily return'
    case 'SMA':
    case 'EMA':
      return `${expr.type}(${expr.period})`
    case 'RSI':
      return `RSI(${expr.period ?? 14})`
    case 'MACD':
      return `MACD ${expr.output ?? 'macd'}`
    case 'ATR':
      return `ATR(${expr.period ?? 14})`
    case 'BOLLINGER':
      return `BB ${expr.band}(${expr.period ?? 20})`
    case 'VOLUME_SMA':
      return `Volume SMA(${expr.period ?? 20})`
    case 'VOLATILITY':
      return `Volatility(${expr.period ?? 20})`
    case 'DRAWDOWN':
      return 'Drawdown'
    case 'ABS':
      return `|${describeOperand(expr.value)}|`
    case 'LAG':
      return `${describeOperand(expr.value)}[-${expr.bars}]`
    case 'INDICATOR': {
      const spec = indicatorSpec(expr.name)
      const values = spec.params.map((param) => expr.params?.[param.key] ?? param.default)
      const label = values.length > 0 ? `${spec.short}(${values.join(', ')})` : spec.short
      return expr.output && spec.outputs.length > 1 ? `${label} ${expr.output}` : label
    }
    case 'ADD':
      return `${describeOperand(expr.left)} + ${describeOperand(expr.right)}`
    case 'SUBTRACT':
      return `${describeOperand(expr.left)} - ${describeOperand(expr.right)}`
    case 'MULTIPLY':
      return `${describeOperand(expr.left)} × ${describeOperand(expr.right)}`
    case 'DIVIDE':
      return `${describeOperand(expr.left)} ÷ ${describeOperand(expr.right)}`
  }
}

function describeOperand(operand: Operand, asPercent = false): string {
  if (typeof operand === 'number') {
    return asPercent ? `${(operand * 100).toFixed(operand * 100 % 1 === 0 ? 0 : 2)}%` : String(operand)
  }
  return describeExpression(operand)
}

/** Renders a condition as a short human-readable line for the UI. */
export function describeCondition(condition: Condition): string {
  switch (condition.type) {
    case 'AND':
      return condition.conditions.map(describeCondition).join(' AND ')
    case 'OR':
      return condition.conditions.map(describeCondition).join(' OR ')
    case 'NOT':
      return `NOT (${describeCondition(condition.condition)})`
    case 'COMPARE': {
      const percent = isPercentOperand(condition.left)
      return `${describeOperand(condition.left)} ${condition.operator} ${describeOperand(condition.right, percent)}`
    }
    case 'CROSS_ABOVE':
      return `${describeOperand(condition.left)} crosses above ${describeOperand(condition.right)}`
    case 'CROSS_BELOW':
      return `${describeOperand(condition.left)} crosses below ${describeOperand(condition.right)}`
  }
}
