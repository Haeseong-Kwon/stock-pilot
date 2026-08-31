import { beforeEach, describe, expect, it } from 'vitest'
import type { Candle } from '@/lib/types'
import { AiResponseSchema, ChartCommandSchema } from '@/lib/schemas/chartCommand'
import { executeCommands } from '@/lib/chart/commandExecutor'
import { describeCondition } from '@/lib/chart/describe'
import { useChartStore } from '@/stores/chartStore'

const DAY = 86400
const START = Date.UTC(2024, 0, 1) / 1000

const candles: Candle[] = Array.from({ length: 320 }, (_, i) => {
  const close = i === 300 ? 92 : 100
  return {
    time: START + i * DAY,
    open: 100,
    high: 101,
    low: i === 300 ? 91 : 99,
    close,
    volume: i === 300 ? 12_000_000 : 1_000_000,
  }
})

beforeEach(() => {
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
})

describe('ChartCommandSchema', () => {
  it('accepts a well-formed signal command', () => {
    expect(
      ChartCommandSchema.safeParse({
        type: 'CREATE_SIGNAL',
        name: 'Large Drop',
        condition: {
          type: 'COMPARE',
          left: { type: 'RETURN', period: 1 },
          operator: '<',
          right: -0.05,
        },
        visualization: { type: 'marker', position: 'aboveBar' },
      }).success,
    ).toBe(true)
  })

  it('rejects an unknown command type', () => {
    expect(ChartCommandSchema.safeParse({ type: 'PLACE_ORDER', symbol: 'AAPL' }).success).toBe(false)
  })

  it('rejects an unsupported indicator', () => {
    expect(
      ChartCommandSchema.safeParse({ type: 'ADD_INDICATOR', indicator: 'ICHIMOKU' }).success,
    ).toBe(false)
  })

  it('rejects out-of-range parameters', () => {
    expect(
      ChartCommandSchema.safeParse({
        type: 'ADD_INDICATOR',
        indicator: 'SMA',
        params: { period: -5 },
      }).success,
    ).toBe(false)
  })

  it('defaults an AI response with no commands to an empty list', () => {
    const parsed = AiResponseSchema.parse({ reply: 'Nothing to change.' })
    expect(parsed.commands).toEqual([])
  })
})

describe('executeCommands', () => {
  it('adds an indicator once, idempotently', () => {
    executeCommands(
      [
        { type: 'ADD_INDICATOR', indicator: 'SMA', params: { period: 20 } },
        { type: 'ADD_INDICATOR', indicator: 'SMA', params: { period: 20 } },
      ],
      candles,
    )
    expect(useChartStore.getState().indicators).toHaveLength(1)
  })

  it('removes an indicator by its parameters', () => {
    executeCommands(
      [
        { type: 'ADD_INDICATOR', indicator: 'SMA', params: { period: 20 } },
        { type: 'ADD_INDICATOR', indicator: 'SMA', params: { period: 50 } },
        { type: 'REMOVE_INDICATOR', indicator: 'SMA', params: { period: 20 } },
      ],
      candles,
    )
    const left = useChartStore.getState().indicators
    expect(left).toHaveLength(1)
    expect(left[0]!.params.period).toBe(50)
  })

  it('reports how many bars a signal matched', () => {
    const [result] = executeCommands(
      [
        {
          type: 'CREATE_SIGNAL',
          name: 'Large Drop',
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
    expect(result!.count).toBe(1)
    expect(result!.status).toBe('ok')
    // Signal names are user data, so they stay literal rather than becoming a key.
    expect(result!.label).toBe('Large Drop')
    expect(useChartStore.getState().signals).toHaveLength(1)
  })

  it('narrows an existing signal in place instead of creating a second one', () => {
    executeCommands(
      [
        {
          type: 'CREATE_SIGNAL',
          name: 'Large Drop',
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
    const [result] = executeCommands(
      [
        {
          type: 'UPDATE_SIGNAL',
          condition: {
            type: 'AND',
            conditions: [
              { type: 'COMPARE', left: { type: 'RETURN', period: 1 }, operator: '<=', right: -0.05 },
              { type: 'COMPARE', left: { type: 'VOLUME' }, operator: '>=', right: 1e12 },
            ],
          },
        },
      ],
      candles,
    )
    expect(useChartStore.getState().signals).toHaveLength(1)
    expect(result!.count).toBe(0)
    expect(result!.status).toBe('empty')
  })

  it('treats "no matches" as a successful analysis, not an error', () => {
    const [result] = executeCommands(
      [
        {
          type: 'CREATE_SIGNAL',
          name: 'Impossible',
          condition: { type: 'COMPARE', left: { type: 'CLOSE' }, operator: '<', right: -1 },
        },
      ],
      candles,
    )
    expect(result!.status).toBe('empty')
    expect(result!.messageKey).toBe('msg.noMatches')
  })

  it('fails cleanly when there is no signal to update', () => {
    const [result] = executeCommands([{ type: 'UPDATE_SIGNAL', condition: { type: 'COMPARE', left: { type: 'CLOSE' }, operator: '>', right: 1 } }], candles)
    expect(result!.status).toBe('error')
    expect(useChartStore.getState().signals).toHaveLength(0)
  })

  it('clears annotations but keeps the price data and symbol', () => {
    executeCommands(
      [
        { type: 'ADD_PRICE_LINE', price: 100 },
        {
          type: 'CREATE_SIGNAL',
          name: 'Any',
          condition: { type: 'COMPARE', left: { type: 'CLOSE' }, operator: '>', right: 1 },
        },
        { type: 'CLEAR_ANNOTATIONS', scope: 'all' },
      ],
      candles,
    )
    const state = useChartStore.getState()
    expect(state.signals).toEqual([])
    expect(state.priceLines).toEqual([])
    expect(state.symbol).toBe('BTCUSDT')
  })

  it('resolves relative dates when zooming', () => {
    const [result] = executeCommands([{ type: 'ZOOM_RANGE', from: '2024-01-01', to: '2024-06-01' }], candles)
    expect(result!.status).toBe('ok')
    expect(useChartStore.getState().zoomRequest?.from).toBe(Date.UTC(2024, 0, 1) / 1000)
  })

  it('rejects an unreadable date range instead of throwing', () => {
    const [result] = executeCommands([{ type: 'ZOOM_RANGE', from: 'whenever' }], candles)
    expect(result!.status).toBe('error')
    expect(result!.messageKey).toBe('msg.badRange')
  })

  it('records support and resistance levels', () => {
    const zigzag: Candle[] = Array.from({ length: 120 }, (_, i) => {
      const close = [100, 110, 100, 90][i % 4] as number
      return { time: START + i * DAY, open: close, high: close + 0.5, low: close - 0.5, close, volume: 1000 }
    })
    const [result] = executeCommands([{ type: 'FIND_SUPPORT_RESISTANCE', maxLevels: 4 }], zigzag)
    expect(result!.count!).toBeGreaterThan(0)
    expect(useChartStore.getState().levels.length).toBeGreaterThan(0)
  })
})

describe('describeCondition', () => {
  it('renders a percentage threshold in human terms', () => {
    expect(
      describeCondition({
        type: 'COMPARE',
        left: { type: 'RETURN', period: 1 },
        operator: '<=',
        right: -0.05,
      }),
    ).toBe('Daily return <= -5%')
  })

  it('renders a compound condition', () => {
    expect(
      describeCondition({
        type: 'AND',
        conditions: [
          { type: 'COMPARE', left: { type: 'RSI', period: 14 }, operator: '<=', right: 30 },
          {
            type: 'CROSS_ABOVE',
            left: { type: 'SMA', period: 50 },
            right: { type: 'SMA', period: 200 },
          },
        ],
      }),
    ).toBe('RSI(14) <= 30 AND SMA(50) crosses above SMA(200)')
  })
})
