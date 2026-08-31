import type { Condition } from '@/lib/schemas/expression'
import type { AiResponse, ChartCommand, IndicatorType } from '@/lib/schemas/chartCommand'
import { INDICATOR_LIST } from '@/lib/analysis/indicators/registry'
import { SYMBOL_CATALOGUE } from '@/lib/market/symbols'
import type { Timeframe } from '@/lib/types'
import { translator, type Locale } from '@/lib/i18n/messages'
import type { ChartContext } from './context'

/**
 * Rule-based intent parser used when no LLM API key is configured (Demo Mode).
 * It covers the documented example commands in Korean and English. It produces
 * exactly the same typed ChartCommands as the LLM path — the analysis engine
 * downstream is identical either way.
 */

const has = (text: string, pattern: RegExp) => pattern.test(text)

const REMOVE = /제거|삭제|지워|지우|없애|빼줘|빼라|remove|delete|hide|drop the/i
const CLEAR_ALL = /전부\s*지워|모두\s*지워|다\s*지워|전체\s*(삭제|초기화)|초기화|모두\s*삭제|clear\s*(all|everything|chart)?|reset/i
const NARROW = /그중|그\s*중|거기서|중에서|그것들\s*중|only|among|narrow|filter|keep\s*(only|the)/i
const DOWN = /하락|떨어|폭락|급락|내린|내려|빠진|crash|drop|drops|dropped|fall|fell|plunge|decline|down|sell.?off/i
const UP = /상승|올라|급등|폭등|오른|올랐|rise|rose|risen|gain|gained|surge|rally|jump|up\b/i

const KOREAN_ALIASES: Record<string, string> = {
  비트코인: 'BTCUSDT',
  이더리움: 'ETHUSDT',
  솔라나: 'SOLUSDT',
  리플: 'XRPUSDT',
  애플: 'AAPL',
  테슬라: 'TSLA',
  엔비디아: 'NVDA',
  마이크로소프트: 'MSFT',
  아마존: 'AMZN',
  구글: 'GOOGL',
  넷플릭스: 'NFLX',
}

const TIMEFRAME_PATTERNS: Array<[RegExp, Timeframe]> = [
  [/1\s*분봉|\b1m\b|one\s*minute/i, '1m'],
  [/5\s*분봉|\b5m\b|five\s*minute/i, '5m'],
  [/15\s*분봉|\b15m\b/i, '15m'],
  [/1\s*시간봉|시간봉|\b1h\b|hourly/i, '1h'],
  [/4\s*시간봉|\b4h\b/i, '4h'],
  [/일봉|\b1d\b|daily/i, '1D'],
  [/주봉|\b1w\b|weekly/i, '1W'],
]

const RANGE_PATTERNS: Array<[RegExp, string]> = [
  [/(최근|지난|last|past)?\s*3\s*(년|years?)/i, '-3y'],
  [/(최근|지난|last|past)?\s*2\s*(년|years?)/i, '-2y'],
  [/(최근|지난|last|past)?\s*1?\s*(년간|년|year)/i, '-1y'],
  [/(최근|지난|last|past)?\s*6\s*(개월|달|months?)/i, '-6M'],
  [/(최근|지난|last|past)?\s*3\s*(개월|달|months?)/i, '-3M'],
  [/(최근|지난|last|past)?\s*1\s*(개월|달|month)/i, '-1M'],
]

function detectRange(text: string): { from: string } | undefined {
  for (const [pattern, value] of RANGE_PATTERNS) {
    if (pattern.test(text)) return { from: value }
  }
  return undefined
}

function numberBefore(text: string, unit: RegExp): number | null {
  const match = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${unit.source})`, 'i').exec(text)
  return match?.[1] ? Number(match[1]) : null
}

function detectMultiplier(text: string): number {
  if (/두\s*배|둘\s*배|2\s*배|2\s*x|twice|double/i.test(text)) return 2
  if (/세\s*배|3\s*배|3\s*x|triple/i.test(text)) return 3
  const explicit = numberBefore(text, /배|x\b|times/)
  return explicit && explicit > 0 ? explicit : 2
}

function detectDates(text: string): string[] {
  const iso = [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0])
  if (iso.length >= 1) return iso
  return [...text.matchAll(/(\d{4})\s*년\s*(?:(\d{1,2})\s*월)?/g)].map((m) => {
    const month = (m[2] ?? '1').padStart(2, '0')
    return `${m[1]}-${month}-01`
  })
}

/**
 * Name matchers built from the registry, longest first so STOCH_RSI wins over
 * STOCH. ASCII names need a word boundary; Korean ones do not have them.
 */
const INDICATOR_MATCHERS: Array<{ type: IndicatorType; pattern: RegExp }> = INDICATOR_LIST.flatMap(
  ({ type, spec }) =>
    [type, type.replace(/_/g, ' '), spec.name, ...(spec.aliases ?? [])].map((name) => ({ type, name })),
)
  .sort((a, b) => b.name.length - a.name.length)
  .map(({ type, name }) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    const ascii = /^[\x20-\x7e]+$/.test(name)
    return { type, pattern: new RegExp(ascii ? `\\b${escaped}\\b` : escaped, 'i') }
  })

/** These read as conditions, not as "put this on the chart". */
const INDICATOR_SUPPRESSORS: Partial<Record<IndicatorType, RegExp>> = {
  // "RSI 30 이하" is a threshold; a bare "RSI" is a request for the pane.
  RSI: /rsi[^0-9]{0,12}\d/i,
  BOLLINGER: /이탈|아래|하단|위|상단|돌파|below|above|break/i,
  STOCH_RSI: /stoch[^0-9]{0,12}\d/i,
}

type Fragment = { condition: Condition; name: string; color: string; indicator?: IndicatorType }

/** RSI has its own rule with oversold/overbought defaults; the rest share this one. */
const GENERIC_THRESHOLD_SKIP = new Set<IndicatorType>(['RSI', 'BOLLINGER', 'VOLUME_SMA', 'SMA', 'EMA'])

const CROSS_UP = /위로|상향\s*돌파|올라온|올라선|crosses?\s*(back\s*)?above|breaks?\s*above/i
const CROSS_DOWN = /아래로|하향\s*돌파|내려온|내려선|crosses?\s*(back\s*)?below|breaks?\s*below/i
const BELOW = /이하|아래|밑|미만|below|under|less/i
const ABOVE = /이상|위|초과|넘|above|over|greater/i

/**
 * "MFI 20 이하", "ADX가 25 넘는", "스토캐스틱이 20을 상향 돌파" — one rule that
 * works for every indicator in the registry instead of a regex per indicator.
 */
function indicatorThresholdFragment(text: string): Fragment | null {
  for (const matcher of INDICATOR_MATCHERS) {
    if (GENERIC_THRESHOLD_SKIP.has(matcher.type)) continue
    const found = matcher.pattern.exec(text)
    if (!found) continue

    // The threshold is the first number after the indicator's name.
    const after = text.slice(found.index + found[0].length)
    const number = /(-?\d+(?:\.\d+)?)/.exec(after)
    if (!number?.[1]) continue
    const level = Number(number[1])
    if (!Number.isFinite(level)) continue

    const spec = INDICATOR_LIST.find((entry) => entry.type === matcher.type)?.spec
    const left = { type: 'INDICATOR' as const, name: matcher.type }
    const label = spec?.short ?? matcher.type

    if (CROSS_UP.test(after)) {
      return {
        condition: { type: 'CROSS_ABOVE', left, right: level },
        name: `${label} ↗ ${level}`,
        color: '#22c55e',
        indicator: matcher.type,
      }
    }
    if (CROSS_DOWN.test(after)) {
      return {
        condition: { type: 'CROSS_BELOW', left, right: level },
        name: `${label} ↘ ${level}`,
        color: '#ef4444',
        indicator: matcher.type,
      }
    }
    const below = BELOW.test(after)
    if (!below && !ABOVE.test(after)) continue
    return {
      condition: { type: 'COMPARE', left, operator: below ? '<=' : '>=', right: level },
      name: `${label} ${below ? '≤' : '≥'} ${level}`,
      color: below ? '#3b82f6' : '#f97316',
      indicator: matcher.type,
    }
  }
  return null
}

const STREAK = /(\d+)\s*(?:일|days?|bars?)?\s*(?:연속|in\s*a\s*row|consecutive)/i

/** "3일 연속 하락" -> one clause per bar, chained with LAG. */
function streakFragment(text: string): Fragment | null {
  const match = STREAK.exec(text)
  if (!match?.[1]) return null
  const bars = Number(match[1])
  if (!Number.isInteger(bars) || bars < 2 || bars > 30) return null
  const down = has(text, DOWN)
  if (!down && !has(text, UP)) return null
  const clause = (lag: number): Condition => ({
    type: 'COMPARE',
    left: lag === 0 ? { type: 'RETURN', period: 1 } : { type: 'LAG', value: { type: 'RETURN', period: 1 }, bars: lag },
    operator: down ? '<' : '>',
    right: 0,
  })
  return {
    condition: { type: 'AND', conditions: Array.from({ length: bars }, (_, i) => clause(i)) },
    name: `${bars}${down ? '연속 하락' : '연속 상승'}`,
    color: down ? '#ef4444' : '#22c55e',
  }
}

function collectFragments(text: string): Fragment[] {
  const fragments: Fragment[] = []

  const streak = streakFragment(text)
  if (streak) fragments.push(streak)

  const threshold = indicatorThresholdFragment(text)
  if (threshold) fragments.push(threshold)

  // Percentage move, e.g. "5% 이상 떨어진" / "rose more than 3%"
  const percent = streak ? null : numberBefore(text, /\s*%|퍼센트|percent/)
  if (percent !== null && (has(text, DOWN) || has(text, UP))) {
    const down = has(text, DOWN)
    fragments.push({
      condition: {
        type: 'COMPARE',
        left: { type: 'RETURN', period: 1 },
        operator: down ? '<=' : '>=',
        right: down ? -(percent / 100) : percent / 100,
      },
      name: down ? `Drop ≥ ${percent}%` : `Gain ≥ ${percent}%`,
      color: down ? '#ef4444' : '#22c55e',
    })
  } else if (!streak && /폭락|급락|crash|plunge|폭등|급등|surge/i.test(text)) {
    // No explicit threshold: scale the move against recent volatility.
    const down = /폭락|급락|crash|plunge/i.test(text)
    fragments.push({
      condition: {
        type: 'COMPARE',
        left: { type: 'RETURN', period: 1 },
        operator: down ? '<=' : '>=',
        right: { type: 'MULTIPLY', left: { type: 'VOLATILITY', period: 20 }, right: down ? -3 : 3 },
      },
      name: down ? 'Volatility Crash' : 'Volatility Surge',
      color: down ? '#ef4444' : '#22c55e',
    })
  }

  if (
    /거래량|volume/i.test(text) &&
    /터진|터졌|급증|폭증|많|spike|spiked|surge|배|x\b|times|이상|above|double|twice/i.test(text)
  ) {
    const multiplier = detectMultiplier(text)
    fragments.push({
      condition: {
        type: 'COMPARE',
        left: { type: 'VOLUME' },
        operator: '>=',
        right: { type: 'MULTIPLY', left: { type: 'VOLUME_SMA', period: 20 }, right: multiplier },
      },
      name: `Volume ≥ ${multiplier}×20D`,
      color: '#eab308',
      indicator: 'VOLUME_SMA',
    })
  }

  if (/골든\s*크로스|golden\s*cross/i.test(text)) {
    fragments.push({
      condition: {
        type: 'CROSS_ABOVE',
        left: { type: 'SMA', period: 50 },
        right: { type: 'SMA', period: 200 },
      },
      name: 'Golden Cross',
      color: '#22c55e',
    })
  }
  if (/데드\s*크로스|death\s*cross|dead\s*cross/i.test(text)) {
    fragments.push({
      condition: {
        type: 'CROSS_BELOW',
        left: { type: 'SMA', period: 50 },
        right: { type: 'SMA', period: 200 },
      },
      name: 'Death Cross',
      color: '#ef4444',
    })
  }

  if (/볼린저|bollinger|\bbb\b/i.test(text) && /이탈|아래|하단|밑|below|under|break/i.test(text)) {
    fragments.push({
      condition: {
        type: 'COMPARE',
        left: { type: 'CLOSE' },
        operator: '<',
        right: { type: 'BOLLINGER', period: 20, stdDev: 2, band: 'lower' },
      },
      name: 'Below Lower Band',
      color: '#a855f7',
      indicator: 'BOLLINGER',
    })
  } else if (/볼린저|bollinger/i.test(text) && /위|상단|above|upper|돌파/i.test(text)) {
    fragments.push({
      condition: {
        type: 'COMPARE',
        left: { type: 'CLOSE' },
        operator: '>',
        right: { type: 'BOLLINGER', period: 20, stdDev: 2, band: 'upper' },
      },
      name: 'Above Upper Band',
      color: '#a855f7',
      indicator: 'BOLLINGER',
    })
  }

  const rsiThreshold = /rsi[^0-9]{0,12}(\d{1,3})/i.exec(text)
  if (rsiThreshold?.[1]) {
    const level = Number(rsiThreshold[1])
    const below = /이하|아래|밑|미만|below|under|less/i.test(text) || (level <= 40 && !/이상|위|초과|above|over/i.test(text))
    fragments.push({
      condition: {
        type: 'COMPARE',
        left: { type: 'RSI', period: 14 },
        operator: below ? '<=' : '>=',
        right: level,
      },
      name: `RSI ${below ? '≤' : '≥'} ${level}`,
      color: '#3b82f6',
      indicator: 'RSI',
    })
  } else if (/과매도|oversold/i.test(text)) {
    fragments.push({
      condition: { type: 'COMPARE', left: { type: 'RSI', period: 14 }, operator: '<=', right: 30 },
      name: 'Oversold',
      color: '#3b82f6',
      indicator: 'RSI',
    })
  } else if (/과매수|overbought/i.test(text)) {
    fragments.push({
      condition: { type: 'COMPARE', left: { type: 'RSI', period: 14 }, operator: '>=', right: 70 },
      name: 'Overbought',
      color: '#f97316',
      indicator: 'RSI',
    })
  }

  return fragments
}

function collectIndicators(text: string, removing: boolean): ChartCommand[] {
  const commands: ChartCommand[] = []
  const type = removing ? 'REMOVE_INDICATOR' : 'ADD_INDICATOR'

  // Moving averages are special: the period comes before the name ("20일선").
  const maPattern = /(\d+)\s*(?:일|day|-day)?\s*(?:선|이동\s*평균(?:선)?|이평(?:선)?|sma|ma|moving\s*average)/gi
  const named = new Set<IndicatorType>()
  for (const match of text.matchAll(maPattern)) {
    const period = Number(match[1])
    if (!Number.isFinite(period) || period < 1 || period > 1000) continue
    const kind: IndicatorType = /지수|ema|exponential/i.test(match[0]) ? 'EMA' : 'SMA'
    commands.push({ type, indicator: kind, params: { period } })
    named.add(kind)
  }
  for (const match of text.matchAll(/(\d+)\s*(?:일)?\s*(?:지수이동평균|ema)/gi)) {
    const period = Number(match[1])
    if (!Number.isFinite(period)) continue
    commands.push({ type, indicator: 'EMA', params: { period } })
    named.add('EMA')
  }

  // Everything else is matched by name against the registry.
  const seen = new Set<IndicatorType>(named)
  for (const matcher of INDICATOR_MATCHERS) {
    if (seen.has(matcher.type)) continue
    if (!matcher.pattern.test(text)) continue
    const suppressor = INDICATOR_SUPPRESSORS[matcher.type]
    if (suppressor?.test(text)) {
      seen.add(matcher.type)
      continue
    }
    seen.add(matcher.type)
    commands.push({ type, indicator: matcher.type })
  }

  return commands
}

const PRICE_LINE_BEFORE = /([\d][\d,]*(?:\.\d+)?)\s*(?:에|에다)?\s*(?:가격선|수평선)/i
const PRICE_LINE_AFTER = /(?:price\s*line|horizontal\s*line)[^0-9]{0,16}([\d][\d,]*(?:\.\d+)?)/i

/** Reads the price out of "77000에 가격선" or "draw a price line at 77000". */
function detectPriceLine(text: string): number | null {
  const match = PRICE_LINE_BEFORE.exec(text) ?? PRICE_LINE_AFTER.exec(text)
  if (!match?.[1]) return null
  const value = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(value) && value > 0 ? value : null
}

function dedupe(commands: ChartCommand[]): ChartCommand[] {
  const seen = new Set<string>()
  return commands.filter((c) => {
    const key = JSON.stringify(c)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function parseLocally(
  input: string,
  context: ChartContext,
  locale: Locale = 'ko',
): AiResponse {
  const text = input.trim()
  const t = translator(locale)
  const commands: ChartCommand[] = []

  if (CLEAR_ALL.test(text) && !/rsi|sma|ema|macd|볼린저|bollinger/i.test(text)) {
    return {
      reply: t('reply.cleared'),
      commands: [{ type: 'CLEAR_ANNOTATIONS', scope: 'all' }],
    }
  }

  // Symbol
  const upper = text.toUpperCase()
  const alias = Object.keys(KOREAN_ALIASES).find((k) => text.includes(k))
  const ticker =
    (alias ? KOREAN_ALIASES[alias] : undefined) ??
    SYMBOL_CATALOGUE.find((s) => new RegExp(`\\b${s.symbol}\\b`).test(upper))?.symbol
  if (ticker && ticker !== context.symbol) commands.push({ type: 'SET_SYMBOL', symbol: ticker })

  // Timeframe
  for (const [pattern, timeframe] of TIMEFRAME_PATTERNS) {
    if (pattern.test(text) && timeframe !== context.timeframe) {
      commands.push({ type: 'SET_TIMEFRAME', timeframe })
      break
    }
  }

  // An explicit date window either zooms the chart or shades the stretch.
  const dates = detectDates(text)
  if (dates.length >= 2) {
    const [from, to] = dates as [string, string]
    if (/강조|하이라이트|highlight|shade/i.test(text)) {
      commands.push({ type: 'HIGHLIGHT_RANGE', from, to })
    } else if (/부터|까지|~|from|to|between|사이/i.test(text)) {
      commands.push({ type: 'ZOOM_RANGE', from, to })
    }
  }

  const priceLine = detectPriceLine(text)
  if (priceLine !== null) commands.push({ type: 'ADD_PRICE_LINE', price: priceLine })

  if (/지지선|저항선|지지\/저항|지지|저항|support|resistance/i.test(text)) {
    const range = detectRange(text)
    commands.push({ type: 'FIND_SUPPORT_RESISTANCE', ...(range ? { range } : {}), maxLevels: 6 })
  }

  const removing = REMOVE.test(text)
  const fragments = collectFragments(text)

  // Indicators the user asked for outright, plus the ones a condition implies.
  commands.push(...collectIndicators(text, removing))
  if (!removing) {
    for (const fragment of fragments) {
      if (fragment.indicator) commands.push({ type: 'ADD_INDICATOR', indicator: fragment.indicator })
    }
  }

  if (fragments.length > 0 && !removing) {
    const merged: Condition =
      fragments.length === 1
        ? (fragments[0] as Fragment).condition
        : { type: 'AND', conditions: fragments.map((f) => f.condition) }
    const name = fragments.map((f) => f.name).join(' + ')
    const color = (fragments[0] as Fragment).color
    const range = detectRange(text)
    const previous = context.signals[context.signals.length - 1]

    if (NARROW.test(text) && previous) {
      commands.push({
        type: 'UPDATE_SIGNAL',
        name: previous.name,
        condition: { type: 'AND', conditions: [previous.condition, merged] },
      })
    } else {
      commands.push({
        type: 'CREATE_SIGNAL',
        name,
        condition: merged,
        ...(range ? { range } : {}),
        visualization: { color, position: 'belowBar', shape: 'circle' },
      })
    }
  }

  if (removing && fragments.length > 0) {
    commands.push({ type: 'REMOVE_SIGNAL' })
  }

  const final = dedupe(commands)
  if (final.length === 0) {
    return { reply: t('reply.help'), commands: [] }
  }

  return { reply: t('reply.applied'), commands: final }
}
