import { describe, expect, it } from 'vitest'
import { LOCALES, MESSAGES, isLocale, translator, type MessageKey } from '@/lib/i18n/messages'
import { parseLocally } from '@/lib/ai/localParser'
import type { ChartContext } from '@/lib/ai/context'
import {
  ChartContextSchema,
  ChatRequestSchema,
  MAX_CONTEXT_INDICATORS,
  MAX_CONTEXT_SIGNALS,
  buildChartContext,
} from '@/lib/ai/context'

const context: ChartContext = {
  symbol: 'BTCUSDT',
  timeframe: '1D',
  barCount: 900,
  indicators: [],
  signals: [],
}

describe('message catalogue', () => {
  it('defaults to Korean', () => {
    expect(LOCALES[0]).toBe('ko')
    expect(ChatRequestSchema.parse({ messages: [{ role: 'user', content: 'hi' }], context }).locale).toBe('ko')
  })

  it('has the same keys in every locale', () => {
    const reference = Object.keys(MESSAGES.ko).sort()
    for (const locale of LOCALES) {
      expect(Object.keys(MESSAGES[locale]).sort()).toEqual(reference)
    }
  })

  it('leaves no string untranslated or empty', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(MESSAGES[locale])) {
        expect(value.trim(), `${locale}:${key}`).not.toBe('')
      }
    }
  })

  it('keeps the same placeholders across locales', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const key of Object.keys(MESSAGES.ko) as MessageKey[]) {
      expect(placeholders(MESSAGES.en[key]), key).toEqual(placeholders(MESSAGES.ko[key]))
    }
  })
})

describe('translator', () => {
  it('interpolates named parameters', () => {
    expect(translator('en')('indicators.remove', { name: 'RSI 14' })).toBe('Remove RSI 14')
    expect(translator('ko')('indicators.remove', { name: 'RSI 14' })).toBe('RSI 14 제거')
  })

  it('uses the English singular for a single match', () => {
    expect(translator('en')('result.matches', { count: 1 })).toBe('1 match')
    expect(translator('en')('result.matches', { count: 7 })).toBe('7 matches')
    expect(translator('ko')('result.matches', { count: 1 })).toBe('1건 일치')
  })

  it('leaves an unknown placeholder untouched rather than printing undefined', () => {
    expect(translator('en')('indicators.remove', {})).toBe('Remove {name}')
  })

  it('validates locale codes', () => {
    expect(isLocale('ko')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})

describe('demo parser replies follow the locale, not the input language', () => {
  it('answers an English prompt in Korean when the app is Korean', () => {
    const response = parseLocally('add RSI', context, 'ko')
    expect(response.reply).toBe(MESSAGES.ko['reply.applied'])
    expect(response.commands).toHaveLength(1)
  })

  it('answers a Korean prompt in English when the app is English', () => {
    const response = parseLocally('RSI 보여줘', context, 'en')
    expect(response.reply).toBe(MESSAGES.en['reply.applied'])
    expect(response.commands).toHaveLength(1)
  })

  it('localizes the clear and help replies too', () => {
    expect(parseLocally('전부 지워', context, 'en').reply).toBe(MESSAGES.en['reply.cleared'])
    expect(parseLocally('오늘 날씨 어때', context, 'ko').reply).toBe(MESSAGES.ko['reply.help'])
  })

  it('parses the same commands regardless of locale', () => {
    const ko = parseLocally('최근 1년간 5% 이상 떨어진 날 표시해', context, 'ko')
    const en = parseLocally('최근 1년간 5% 이상 떨어진 날 표시해', context, 'en')
    expect(ko.commands).toEqual(en.commands)
  })
})

describe('chat context stays within the request schema', () => {
  const candles = Array.from({ length: 500 }, (_, i) => ({
    time: 1_700_000_000 + i * 86400,
    open: 100,
    high: 101,
    low: 99,
    close: 100 + i,
    volume: 1000,
  }))
  const condition = {
    type: 'COMPARE' as const,
    left: { type: 'CLOSE' as const },
    operator: '>' as const,
    right: 1,
  }

  it('truncates a long signal list instead of producing an invalid request', () => {
    const signals = Array.from({ length: 25 }, (_, i) => ({ name: `s${i}`, condition }))
    const built = buildChartContext({
      symbol: 'BTCUSDT',
      timeframe: '1D',
      candles,
      indicators: Array.from({ length: 40 }, () => ({ type: 'SMA' as const, params: { period: 20 } })),
      signals,
    })

    expect(built.signals).toHaveLength(MAX_CONTEXT_SIGNALS)
    expect(built.indicators).toHaveLength(MAX_CONTEXT_INDICATORS)
    expect(ChartContextSchema.safeParse(built).success).toBe(true)
    expect(
      ChatRequestSchema.safeParse({ messages: [{ role: 'user', content: 'hi' }], context: built })
        .success,
    ).toBe(true)
  })

  it('keeps the most recent signals, which is what a follow-up refers to', () => {
    const signals = Array.from({ length: 12 }, (_, i) => ({ name: `s${i}`, condition }))
    const built = buildChartContext({
      symbol: 'BTCUSDT',
      timeframe: '1D',
      candles,
      indicators: [],
      signals,
    })
    expect(built.signals.at(-1)?.name).toBe('s11')
    expect(built.signals[0]?.name).toBe('s2')
  })

  it('carries the loaded bar range', () => {
    const built = buildChartContext({
      symbol: 'AAPL',
      timeframe: '1D',
      candles,
      indicators: [],
      signals: [],
    })
    expect(built.barCount).toBe(500)
    expect(built.lastPrice).toBe(candles.at(-1)?.close)
    expect(built.firstBarDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('tolerates an empty chart', () => {
    const built = buildChartContext({
      symbol: 'BTCUSDT',
      timeframe: '1D',
      candles: [],
      indicators: [],
      signals: [],
    })
    expect(built.barCount).toBe(0)
    expect(ChartContextSchema.safeParse(built).success).toBe(true)
  })
})
