import type { ChartCommandType } from '@/lib/schemas/chartCommand'
import type { Locale } from '@/lib/i18n/messages'

export type CatalogueEntry = {
  id: string
  /** The exact text sent to the parser when the row is clicked. */
  prompt: Record<Locale, string>
  effect: Record<Locale, string>
  /** Asserted in tests: clicking this must produce a command of this type. */
  produces: ChartCommandType
  /** Does nothing until a signal exists, so the row is disabled until then. */
  requires?: 'signal'
}

export type CatalogueGroup = {
  id: string
  title: Record<Locale, string>
  entries: CatalogueEntry[]
}

/**
 * Everything Demo Mode can do, as clickable prompts. `tests/catalogue.test.ts`
 * runs every entry through the parser, so a row can never advertise something
 * the app no longer supports.
 */
export const COMMAND_CATALOGUE: CatalogueGroup[] = [
  {
    id: 'indicators',
    title: { ko: '지표', en: 'Indicators' },
    entries: [
      {
        id: 'sma',
        prompt: { ko: '20일 이동평균선 추가해', en: 'add the 20 day moving average' },
        effect: { ko: 'SMA(20)를 캔들 위에 겹쳐 그립니다', en: 'Overlays SMA(20) on the candles' },
        produces: 'ADD_INDICATOR',
      },
      {
        id: 'ema',
        prompt: { ko: '50일 지수이동평균 추가', en: 'add the 50 EMA' },
        effect: { ko: 'EMA(50)를 겹쳐 그립니다', en: 'Overlays EMA(50)' },
        produces: 'ADD_INDICATOR',
      },
      {
        id: 'rsi',
        prompt: { ko: 'RSI 보여줘', en: 'add RSI' },
        effect: { ko: 'RSI(14) 전용 패널을 만듭니다', en: 'Opens an RSI(14) pane' },
        produces: 'ADD_INDICATOR',
      },
      {
        id: 'macd',
        prompt: { ko: 'MACD 추가해', en: 'add MACD' },
        effect: { ko: 'MACD 12/26/9 패널을 만듭니다', en: 'Opens a MACD 12/26/9 pane' },
        produces: 'ADD_INDICATOR',
      },
      {
        id: 'bollinger',
        prompt: { ko: '볼린저밴드 추가', en: 'add Bollinger Bands' },
        effect: { ko: '20일, 2σ 밴드를 겹쳐 그립니다', en: 'Overlays the 20, 2σ bands' },
        produces: 'ADD_INDICATOR',
      },
      {
        id: 'atr',
        prompt: { ko: 'ATR 추가', en: 'add ATR' },
        effect: { ko: 'ATR(14) 전용 패널을 만듭니다', en: 'Opens an ATR(14) pane' },
        produces: 'ADD_INDICATOR',
      },
      {
        id: 'volumeSma',
        prompt: { ko: '거래량 이동평균 추가', en: 'add the volume SMA' },
        effect: { ko: '거래량 패널에 20일 평균선을 얹습니다', en: 'Adds a 20-bar average to the volume pane' },
        produces: 'ADD_INDICATOR',
      },
      {
        id: 'removeIndicator',
        prompt: { ko: '20일선 제거해', en: 'remove the 20 day moving average' },
        effect: { ko: '해당 지표만 차트에서 뺍니다', en: 'Takes just that indicator off the chart' },
        produces: 'REMOVE_INDICATOR',
      },
    ],
  },
  {
    id: 'moves',
    title: { ko: '가격 변동', en: 'Price moves' },
    entries: [
      {
        id: 'drop',
        prompt: {
          ko: '최근 1년간 5% 이상 떨어진 날 표시해',
          en: 'mark days that dropped more than 5% in the last year',
        },
        effect: { ko: '1일 수익률 ≤ −5% 인 봉에 마커', en: 'Markers where the 1-bar return is ≤ −5%' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'rise',
        prompt: { ko: '하루에 5% 이상 오른 날 표시', en: 'mark days that rose more than 5%' },
        effect: { ko: '1일 수익률 ≥ +5% 인 봉에 마커', en: 'Markers where the 1-bar return is ≥ +5%' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'crash',
        prompt: { ko: '큰 폭락 구간 표시', en: 'mark the big crashes' },
        effect: {
          ko: '숫자를 안 주면 최근 변동성의 3배로 판단합니다',
          en: 'With no threshold given, uses 3× recent volatility',
        },
        produces: 'CREATE_SIGNAL',
      },
    ],
  },
  {
    id: 'volume',
    title: { ko: '거래량', en: 'Volume' },
    entries: [
      {
        id: 'spike',
        prompt: { ko: '거래량 급증한 날 찾아줘', en: 'find volume spikes' },
        effect: { ko: '거래량 ≥ 20일 평균 × 2', en: 'Volume ≥ 2× its own 20-bar average' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'spike3x',
        prompt: {
          ko: '거래량이 평소보다 세 배 이상 터진 날 표시',
          en: 'find days with 3x the usual volume',
        },
        effect: { ko: '배수를 직접 지정할 수 있습니다', en: 'The multiplier is yours to set' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'narrow',
        prompt: {
          ko: '그중 거래량이 두 배 이상 터진 것만 남겨',
          en: 'keep only the ones with double the volume',
        },
        effect: {
          ko: '새 시그널을 만들지 않고 기존 조건에 AND로 덧붙입니다',
          en: 'ANDs onto the existing signal instead of making a new one',
        },
        produces: 'UPDATE_SIGNAL',
        requires: 'signal',
      },
    ],
  },
  {
    id: 'crosses',
    title: { ko: '추세 전환', en: 'Trend crosses' },
    entries: [
      {
        id: 'golden',
        prompt: { ko: '골든크로스 발생한 곳 표시', en: 'mark golden crosses' },
        effect: { ko: 'SMA(50)이 SMA(200)을 상향 돌파한 봉', en: 'SMA(50) crossing above SMA(200)' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'death',
        prompt: { ko: '데드크로스 발생한 곳 표시', en: 'mark death crosses' },
        effect: { ko: 'SMA(50)이 SMA(200)을 하향 돌파한 봉', en: 'SMA(50) crossing below SMA(200)' },
        produces: 'CREATE_SIGNAL',
      },
    ],
  },
  {
    id: 'momentum',
    title: { ko: '모멘텀', en: 'Momentum' },
    entries: [
      {
        id: 'oversold',
        prompt: { ko: 'RSI 30 이하인 날 표시', en: 'mark days when RSI is below 30' },
        effect: { ko: '기준값을 직접 지정할 수 있습니다', en: 'The threshold is yours to set' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'overbought',
        prompt: { ko: '과매수 구간 표시', en: 'mark overbought days' },
        effect: { ko: '기준값을 안 주면 RSI ≥ 70', en: 'Defaults to RSI ≥ 70 when unspecified' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'bbLower',
        prompt: {
          ko: '볼린저밴드 아래로 이탈한 곳 보여줘',
          en: 'show closes below the lower Bollinger band',
        },
        effect: { ko: '밴드도 함께 차트에 올라갑니다', en: 'Adds the bands to the chart as well' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'bbUpper',
        prompt: {
          ko: '볼린저밴드 위로 돌파한 곳 표시',
          en: 'show closes above the upper Bollinger band',
        },
        effect: { ko: '종가 > 상단 밴드', en: 'Close above the upper band' },
        produces: 'CREATE_SIGNAL',
      },
    ],
  },
  {
    id: 'compound',
    title: { ko: '복합 조건', en: 'Compound conditions' },
    entries: [
      {
        id: 'rsiAndDrop',
        prompt: {
          ko: 'RSI 30 이하이고 하루에 3% 이상 떨어진 날 보여줘',
          en: 'mark days when RSI is below 30 and price fell more than 3%',
        },
        effect: { ko: '두 조건을 AND로 묶습니다', en: 'Joins both clauses with AND' },
        produces: 'CREATE_SIGNAL',
      },
      {
        id: 'dropAndVolume',
        prompt: {
          ko: '5% 이상 하락하고 거래량도 두 배 이상 터진 날 표시',
          en: 'mark days that dropped 5% with double the volume',
        },
        effect: { ko: '가격과 거래량 조건을 한 번에', en: 'Price and volume clauses in one signal' },
        produces: 'CREATE_SIGNAL',
      },
    ],
  },
  {
    id: 'levels',
    title: { ko: '레벨', en: 'Levels' },
    entries: [
      {
        id: 'supportResistance',
        prompt: {
          ko: '최근 6개월 지지선과 저항선 찾아줘',
          en: 'find support and resistance over the last 6 months',
        },
        effect: { ko: '피벗을 군집화해 수평선으로 그립니다', en: 'Clusters pivots into horizontal levels' },
        produces: 'FIND_SUPPORT_RESISTANCE',
      },
      {
        id: 'priceLine',
        prompt: { ko: '77000에 가격선 그어줘', en: 'draw a price line at 77000' },
        effect: { ko: '지정한 가격에 수평선을 놓습니다', en: 'Puts a horizontal line at that price' },
        produces: 'ADD_PRICE_LINE',
      },
    ],
  },
  {
    id: 'control',
    title: { ko: '차트 제어', en: 'Chart control' },
    entries: [
      {
        id: 'symbol',
        prompt: { ko: '애플 차트 보여줘', en: 'switch to AAPL' },
        effect: {
          ko: '심볼을 바꾸면 지표와 시그널이 전부 재계산됩니다',
          en: 'Indicators and signals all recompute on the new symbol',
        },
        produces: 'SET_SYMBOL',
      },
      {
        id: 'timeframe',
        prompt: { ko: '주봉으로 바꿔줘', en: 'switch to the weekly chart' },
        effect: { ko: '공급자가 지원하는 봉으로 전환합니다', en: 'Switches to any timeframe the provider serves' },
        produces: 'SET_TIMEFRAME',
      },
      {
        id: 'zoom',
        prompt: {
          ko: '2024년 1월부터 2025년 1월까지만 보여줘',
          en: 'show only 2024-01-01 to 2025-01-01',
        },
        effect: { ko: '보이는 구간을 그 기간으로 맞춥니다', en: 'Sets the visible range to that window' },
        produces: 'ZOOM_RANGE',
      },
      {
        id: 'highlight',
        prompt: {
          ko: '2024년 3월부터 2024년 6월까지 강조해',
          en: 'highlight 2024-03-01 to 2024-06-01',
        },
        effect: { ko: '해당 구간에 음영 밴드를 씌웁니다', en: 'Shades that stretch of the chart' },
        produces: 'HIGHLIGHT_RANGE',
      },
      {
        id: 'removeSignal',
        prompt: { ko: '5% 하락 시그널 지워', en: 'remove the 5% drop signal' },
        effect: { ko: '시그널만 지우고 지표는 남깁니다', en: 'Drops the signals, keeps the indicators' },
        produces: 'REMOVE_SIGNAL',
      },
      {
        id: 'clear',
        prompt: { ko: '전부 지워', en: 'clear everything' },
        effect: { ko: '시그널과 주석을 지우고 캔들은 남깁니다', en: 'Clears annotations, keeps the candles' },
        produces: 'CLEAR_ANNOTATIONS',
      },
    ],
  },
]

export const CATALOGUE_ENTRIES: CatalogueEntry[] = COMMAND_CATALOGUE.flatMap((g) => g.entries)
