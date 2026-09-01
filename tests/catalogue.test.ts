import { describe, expect, it } from 'vitest'
import { CATALOGUE_ENTRIES, COMMAND_CATALOGUE } from '@/lib/ai/commandCatalogue'
import { parseLocally } from '@/lib/ai/localParser'
import { AiResponseSchema } from '@/lib/schemas/chartCommand'
import { LOCALES } from '@/lib/i18n/messages'
import type { ChartContext } from '@/lib/ai/context'
import { executeCommands } from '@/lib/chart/commandExecutor'
import { useChartStore } from '@/stores/chartStore'
import type { Candle } from '@/lib/types'

const DAY = 86400
const START = Date.UTC(2023, 0, 1) / 1000

/** 400 bars with one hard down day, so signals have something to find. */
const candles: Candle[] = Array.from({ length: 400 }, (_, i) => {
  const close = i === 350 ? 88 : 100 + Math.sin(i / 9) * 6
  return {
    time: START + i * DAY,
    open: 100,
    high: close + 1,
    low: close - 1,
    close,
    volume: i === 350 ? 9_000_000 : 1_000_000,
  }
})

const baseContext: ChartContext = {
  symbol: 'BTCUSDT',
  timeframe: '1D',
  barCount: candles.length,
  indicators: [],
  signals: [],
  drawings: [],
}

const withSignal: ChartContext = {
  ...baseContext,
  signals: [
    {
      name: 'Drop ≥ 5%',
      condition: { type: 'COMPARE', left: { type: 'RETURN', period: 1 }, operator: '<=', right: -0.05 },
    },
  ],
}

describe('command catalogue integrity', () => {
  it('has unique ids', () => {
    const ids = CATALOGUE_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every entry a prompt and an effect in every locale', () => {
    for (const entry of CATALOGUE_ENTRIES) {
      for (const locale of LOCALES) {
        expect(entry.prompt[locale]?.trim(), `${entry.id}.prompt.${locale}`).toBeTruthy()
        expect(entry.effect[locale]?.trim(), `${entry.id}.effect.${locale}`).toBeTruthy()
      }
    }
  })

  it('groups every entry', () => {
    expect(COMMAND_CATALOGUE.flatMap((g) => g.entries)).toHaveLength(CATALOGUE_ENTRIES.length)
  })
})

describe('every catalogue entry actually runs in Demo Mode', () => {
  for (const entry of CATALOGUE_ENTRIES) {
    for (const locale of LOCALES) {
      it(`${entry.id} (${locale}) produces ${entry.produces}`, () => {
        const context = entry.requires === 'signal' ? withSignal : baseContext
        const response = parseLocally(entry.prompt[locale], context, locale)

        expect(AiResponseSchema.safeParse(response).success).toBe(true)
        expect(
          response.commands.map((c) => c.type),
          `"${entry.prompt[locale]}" produced ${JSON.stringify(response.commands)}`,
        ).toContain(entry.produces)
      })
    }
  }
})

describe('every catalogue entry survives execution against real candles', () => {
  for (const entry of CATALOGUE_ENTRIES) {
    it(`${entry.id} executes without error`, () => {
      useChartStore.setState({
        symbol: 'BTCUSDT',
        timeframe: '1D',
        indicators: [],
        signals: [],
        priceLines: [],
        highlights: [],
        levels: [],
        zoomRequest: null,
      })
      if (entry.requires === 'signal') {
        executeCommands(
          [
            {
              type: 'CREATE_SIGNAL',
              name: 'Drop ≥ 5%',
              condition: {
                type: 'COMPARE',
                left: { type: 'RETURN', period: 1 },
                operator: '<=',
                right: -0.05,
              },
            },
          ],
          candles,
        )
      }

      const context = entry.requires === 'signal' ? withSignal : baseContext
      const { commands } = parseLocally(entry.prompt.ko, context, 'ko')
      const results = executeCommands(commands, candles)

      expect(results.length).toBeGreaterThan(0)
      // "no matches" is a valid analysis outcome; a thrown command is not.
      expect(results.filter((r) => r.status === 'error')).toEqual([])
    })
  }
})
