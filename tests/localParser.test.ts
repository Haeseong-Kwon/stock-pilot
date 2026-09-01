import { describe, expect, it } from 'vitest'
import { parseLocally } from '@/lib/ai/localParser'
import type { ChartContext } from '@/lib/ai/context'
import type { ChartCommand } from '@/lib/schemas/chartCommand'
import { AiResponseSchema } from '@/lib/schemas/chartCommand'

const base: ChartContext = {
  symbol: 'BTCUSDT',
  timeframe: '1D',
  barCount: 900,
  indicators: [],
  signals: [],
  drawings: [],
}

const withSignal: ChartContext = {
  ...base,
  signals: [
    {
      name: 'Drop ≥ 5%',
      condition: { type: 'COMPARE', left: { type: 'RETURN', period: 1 }, operator: '<=', right: -0.05 },
    },
  ],
}

function run(text: string, context: ChartContext = base): ChartCommand[] {
  const response = parseLocally(text, context)
  // Everything the parser emits must satisfy the same schema the LLM path uses.
  expect(AiResponseSchema.safeParse(response).success).toBe(true)
  return response.commands
}

const find = <T extends ChartCommand['type']>(commands: ChartCommand[], type: T) =>
  commands.find((c) => c.type === type) as Extract<ChartCommand, { type: T }> | undefined

describe('demo-mode parser — documented acceptance prompts', () => {
  it('1. adds a 20-period SMA', () => {
    expect(find(run('20일 이동평균선 추가해'), 'ADD_INDICATOR')).toMatchObject({
      indicator: 'SMA',
      params: { period: 20 },
    })
  })

  it('2. adds a 50-period SMA', () => {
    expect(find(run('50일선도 추가'), 'ADD_INDICATOR')).toMatchObject({
      indicator: 'SMA',
      params: { period: 50 },
    })
  })

  it('3. removes the 20-period SMA', () => {
    expect(find(run('20일선 제거해'), 'REMOVE_INDICATOR')).toMatchObject({
      indicator: 'SMA',
      params: { period: 20 },
    })
  })

  it('4. shows RSI', () => {
    expect(find(run('RSI 보여줘'), 'ADD_INDICATOR')).toMatchObject({ indicator: 'RSI' })
  })

  it('5. marks days that fell more than 5% over the last year', () => {
    const signal = find(run('최근 1년간 5% 이상 떨어진 날 빨간색으로 표시해'), 'CREATE_SIGNAL')
    expect(signal?.condition).toEqual({
      type: 'COMPARE',
      left: { type: 'RETURN', period: 1 },
      operator: '<=',
      right: -0.05,
    })
    expect(signal?.range).toEqual({ from: '-1y' })
  })

  it('6. narrows the existing signal to high-volume bars', () => {
    const update = find(run('그중 거래량이 평소보다 두 배 이상 터진 것만 남겨', withSignal), 'UPDATE_SIGNAL')
    expect(update?.name).toBe('Drop ≥ 5%')
    expect(update?.condition).toEqual({
      type: 'AND',
      conditions: [
        withSignal.signals[0]!.condition,
        {
          type: 'COMPARE',
          left: { type: 'VOLUME' },
          operator: '>=',
          right: { type: 'MULTIPLY', left: { type: 'VOLUME_SMA', period: 20 }, right: 2 },
        },
      ],
    })
  })

  it('7. marks golden crosses', () => {
    expect(find(run('골든크로스 발생한 곳 표시'), 'CREATE_SIGNAL')?.condition).toEqual({
      type: 'CROSS_ABOVE',
      left: { type: 'SMA', period: 50 },
      right: { type: 'SMA', period: 200 },
    })
  })

  it('8. marks closes below the lower Bollinger band', () => {
    const commands = run('볼린저밴드 아래로 이탈한 곳 보여줘')
    expect(find(commands, 'CREATE_SIGNAL')?.condition).toEqual({
      type: 'COMPARE',
      left: { type: 'CLOSE' },
      operator: '<',
      right: { type: 'BOLLINGER', period: 20, stdDev: 2, band: 'lower' },
    })
    expect(find(commands, 'ADD_INDICATOR')).toMatchObject({ indicator: 'BOLLINGER' })
  })

  it('9. finds support and resistance over six months', () => {
    expect(find(run('최근 6개월 지지선과 저항선 찾아줘'), 'FIND_SUPPORT_RESISTANCE')?.range).toEqual({
      from: '-6M',
    })
  })

  it('10. builds a compound RSI + drawdown condition', () => {
    const signal = find(run('RSI 30 이하이고 하루에 3% 이상 떨어진 날 보여줘'), 'CREATE_SIGNAL')
    expect(signal?.condition).toEqual({
      type: 'AND',
      conditions: [
        { type: 'COMPARE', left: { type: 'RETURN', period: 1 }, operator: '<=', right: -0.03 },
        { type: 'COMPARE', left: { type: 'RSI', period: 14 }, operator: '<=', right: 30 },
      ],
    })
  })

  it('11. clears annotations without touching the symbol', () => {
    const commands = run('전부 지워')
    expect(commands).toEqual([{ type: 'CLEAR_ANNOTATIONS', scope: 'all' }])
  })

  it('12. zooms to an explicit date window', () => {
    expect(find(run('2024년 1월부터 2025년 1월까지만 보여줘'), 'ZOOM_RANGE')).toMatchObject({
      from: '2024-01-01',
      to: '2025-01-01',
    })
  })
})

describe('demo-mode parser — English and misc', () => {
  it('understands an English drop request', () => {
    const signal = find(run('mark days that dropped more than 5% in the last year'), 'CREATE_SIGNAL')
    expect(signal?.condition).toMatchObject({ operator: '<=', right: -0.05 })
    expect(signal?.range).toEqual({ from: '-1y' })
  })

  it('understands English oversold wording', () => {
    expect(find(run('show me the oversold days'), 'CREATE_SIGNAL')?.condition).toEqual({
      type: 'COMPARE',
      left: { type: 'RSI', period: 14 },
      operator: '<=',
      right: 30,
    })
  })

  it('switches symbol from a Korean alias', () => {
    expect(find(run('애플 차트 보여줘'), 'SET_SYMBOL')).toMatchObject({ symbol: 'AAPL' })
  })

  it('switches timeframe', () => {
    expect(find(run('주봉으로 바꿔줘'), 'SET_TIMEFRAME')).toMatchObject({ timeframe: '1W' })
  })

  it('falls back to a help message it cannot parse', () => {
    const response = parseLocally('안녕하세요 오늘 기분이 어떤가요', base)
    expect(response.commands).toEqual([])
    expect(response.reply.length).toBeGreaterThan(0)
  })

  it('scales an unquantified crash against recent volatility', () => {
    expect(find(run('큰 폭락 구간 표시'), 'CREATE_SIGNAL')?.condition).toEqual({
      type: 'COMPARE',
      left: { type: 'RETURN', period: 1 },
      operator: '<=',
      right: { type: 'MULTIPLY', left: { type: 'VOLATILITY', period: 20 }, right: -3 },
    })
  })
})
