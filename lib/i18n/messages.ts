export const LOCALES = ['ko', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = { ko: '한국어', en: 'English' }

/** Korean is the source of truth; `en` must mirror its keys exactly. */
const ko = {
  'toolbar.demoData': '데모 데이터',
  'toolbar.indicators': '지표',
  'toolbar.timeframeUnsupported': '{provider}는 {timeframe} 봉을 제공하지 않습니다',
  'toolbar.about': '설정 및 정보',
  'toolbar.chartType': '차트 종류',
  'toolbar.priceScale': '가격 축',
  'toolbar.range': '기간',
  'stats.dayRange': '당일',
  'stats.periodRange': '기간',
  'stats.volume': '거래량',
  'search.recent': '최근',
  'chart.retry': '다시 시도',

  'about.title': 'ChartPilot 정보',
  'about.body':
    '자연어로 설명한 조건은 타입이 지정된 명령으로 변환되어 결정론적 분석 엔진이 계산합니다. 모델은 가격·날짜·개수를 직접 계산하지 않습니다.',
  'about.provider': '시장 데이터 공급자',
  'about.unknownProvider': '알 수 없음',
  'about.disclaimer': '연구 및 학습용 도구입니다. 투자 자문이 아닙니다.',
  'about.language': '언어',
  'about.reset': '작업공간 초기화',
  'about.resetHint': '지표·시그널·차트 설정을 지우고 처음 상태로 되돌립니다.',
  'about.shortcuts': '단축키',
  'about.shortcutSearch': '심볼 검색',
  'about.shortcutData': '데이터 윈도우',
  'about.shortcutLog': '로그 축 전환',

  'search.custom': '직접 입력한 티커',
  'search.placeholder': '심볼 검색 — AAPL, NVDA, BTCUSDT…',
  'search.empty': '일치하는 심볼이 없습니다.',
  'search.useTicker': '이 티커로 검색',
  'search.kind.crypto': '암호화폐',
  'search.kind.stock': '주식',

  'indicators.filter': '지표 검색…',
  'indicators.empty': '일치하는 항목이 없습니다.',
  'indicators.remove': '{name} 제거',
  'indicators.period': '{type} 기간',
  'indicators.category.trend': '추세',
  'indicators.category.momentum': '모멘텀',
  'indicators.category.volatility': '변동성',
  'indicators.category.volume': '거래량',
  'indicators.hint.sma': '단순 이동평균',
  'indicators.hint.ema': '지수 이동평균',
  'indicators.hint.rsi': '상대강도지수 · 별도 패널',
  'indicators.hint.macd': '이동평균 수렴·확산 · 별도 패널',
  'indicators.hint.bollinger': '변동성 밴드',
  'indicators.hint.atr': '평균 실질 변동폭 · 별도 패널',
  'indicators.hint.volumeSma': '평균 거래량 오버레이',
  'indicators.hint.volatility': '수익률 표준편차 · 별도 패널',

  'chart.loading': '시장 데이터를 불러오는 중…',
  'dataWindow.title': '데이터 윈도우',
  'dataWindow.close': '데이터 윈도우 닫기',
  'dataWindow.open': '데이터 윈도우 (D)',
  'chart.error.title': '시장 데이터를 가져올 수 없습니다',

  'tooltip.change': '변화율',
  'tooltip.volume': '거래량',
  'tooltip.volumeRatio': '{ratio}× 20일 평균',
  'tooltip.rsi': 'RSI',

  'ai.title': 'AI 애널리스트',
  'ai.subtitle': '명령 인터페이스',
  'ai.clear': '대화 지우기',
  'ai.role': '애널리스트',
  'ai.empty.title': '차트에서 무엇을 보고 싶은지 설명해 주세요.',
  'ai.empty.body':
    '조건은 타입이 지정된 명령으로 변환되어 실제 캔들에 대해 평가됩니다. 모델이 날짜나 개수를 지어내지 않습니다.',
  'ai.thinking': '해석하는 중…',
  'ai.placeholder': '예: 5% 이상 떨어진 날 표시해',
  'ai.disclaimer': '분석 도구입니다. 투자 자문이 아닙니다.',
  'ai.send': '보내기',
  'ai.try': '예시',
  'gallery.open': '명령 갤러리',
  'gallery.title': '지금 바로 실행되는 명령',
  'gallery.subtitle': 'API 키 없이, 클릭 한 번으로 전부 실행됩니다.',
  'gallery.search': '명령 검색…',
  'gallery.empty': '일치하는 명령이 없습니다.',
  'gallery.close': '닫기',
  'gallery.needsSignal': '먼저 시그널을 하나 만들어야 동작합니다',
  'gallery.count': '{count}개 명령',
  'gallery.seeAll': '전체 보기',
  'ai.error.network': '분석 서비스에 연결할 수 없습니다. 연결을 확인한 뒤 다시 시도해 주세요.',
  'ai.error.invalid': '응답을 검증하지 못해 차트에는 아무것도 적용하지 않았습니다.',
  'ai.error.status': '요청이 실패했습니다 ({status})',

  'result.matches': '{count}건 일치',

  'cmd.symbol': '심볼 변경',
  'cmd.timeframe': '타임프레임 변경',
  'cmd.indicatorAdded': '지표 추가',
  'cmd.indicatorRemoved': '지표 제거',
  'cmd.indicatorUpdated': '지표 수정',
  'cmd.nothingToRemove': '제거할 항목 없음',
  'cmd.notOnChart': '차트에 없는 지표',
  'cmd.signalRemoved': '시그널 제거',
  'cmd.rangeHighlighted': '구간 강조',
  'cmd.priceLine': '가격선',
  'cmd.zoomed': '구간 확대',
  'cmd.cleared': '초기화',
  'cmd.levels': '지지 · 저항',
  'cmd.failed': '실패',

  'msg.noMatches': '조건과 일치하는 구간을 찾지 못했습니다.',
  'msg.noLevels': '이 구간에서는 반복되는 레벨을 찾지 못했습니다.',
  'msg.noSignal': '아직 수정할 시그널이 없습니다.',
  'msg.badRange': '날짜 범위를 이해하지 못했습니다.',
  'msg.unexpected': '명령을 실행하지 못했습니다.',

  'reply.applied': '요청하신 내용을 차트에 적용했습니다.',
  'reply.cleared': '차트의 시그널과 주석을 모두 지웠습니다.',
  'reply.help':
    '데모 모드에서는 지표 추가·제거, 조건 기반 시그널, 지지·저항 탐색 같은 명령을 이해합니다. 예: "RSI 추가", "최근 1년간 5% 이상 하락한 날 표시".',
  'reply.invalid': '그 요청을 유효한 차트 명령으로 바꾸지 못했습니다. 지표나 조건을 조금 더 구체적으로 알려주세요.',
  'reply.providerDown': 'AI 공급자에 연결할 수 없어 내장 파서로 처리했습니다.',
  'reply.providerDownEmpty': '지금은 AI 공급자에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  'reply.partial': '(명령 {count}개는 형식이 올바르지 않아 실행하지 않았습니다.)',
} as const

export type MessageKey = keyof typeof ko

const en: Record<MessageKey, string> = {
  'toolbar.demoData': 'Demo data',
  'toolbar.indicators': 'Indicators',
  'toolbar.timeframeUnsupported': '{provider} does not serve {timeframe} bars',
  'toolbar.about': 'Settings and about',
  'toolbar.chartType': 'Chart type',
  'toolbar.priceScale': 'Price scale',
  'toolbar.range': 'Range',
  'stats.dayRange': 'Day',
  'stats.periodRange': 'Range',
  'stats.volume': 'Vol',
  'search.recent': 'Recent',
  'chart.retry': 'Retry',

  'about.title': 'About ChartPilot',
  'about.body':
    'Conditions you describe in plain language are compiled into a typed command and evaluated by a deterministic analysis engine — the model never computes prices, dates, or counts.',
  'about.provider': 'Market data provider',
  'about.unknownProvider': 'unknown',
  'about.disclaimer': 'For research and education only. Nothing here is investment advice.',
  'about.language': 'Language',
  'about.reset': 'Reset workspace',
  'about.resetHint': 'Clears indicators, signals and chart settings back to defaults.',
  'about.shortcuts': 'Shortcuts',
  'about.shortcutSearch': 'Symbol search',
  'about.shortcutData': 'Data window',
  'about.shortcutLog': 'Toggle log scale',

  'search.custom': 'Custom ticker',
  'search.placeholder': 'Search symbol — AAPL, NVDA, BTCUSDT…',
  'search.empty': 'No matching symbol.',
  'search.useTicker': 'Search this ticker',
  'search.kind.crypto': 'crypto',
  'search.kind.stock': 'stock',

  'indicators.filter': 'Filter indicators…',
  'indicators.empty': 'Nothing matches.',
  'indicators.remove': 'Remove {name}',
  'indicators.period': '{type} period',
  'indicators.category.trend': 'Trend',
  'indicators.category.momentum': 'Momentum',
  'indicators.category.volatility': 'Volatility',
  'indicators.category.volume': 'Volume',
  'indicators.hint.sma': 'Simple moving average',
  'indicators.hint.ema': 'Exponential moving average',
  'indicators.hint.rsi': 'Relative strength index · own pane',
  'indicators.hint.macd': 'Convergence divergence · own pane',
  'indicators.hint.bollinger': 'Volatility bands',
  'indicators.hint.atr': 'Average true range · own pane',
  'indicators.hint.volumeSma': 'Average volume overlay',
  'indicators.hint.volatility': 'Rolling stdev of returns · own pane',

  'chart.loading': 'Loading market data…',
  'dataWindow.title': 'Data window',
  'dataWindow.close': 'Close data window',
  'dataWindow.open': 'Data window (D)',
  'chart.error.title': 'Market data unavailable',

  'tooltip.change': 'Change',
  'tooltip.volume': 'Volume',
  'tooltip.volumeRatio': '{ratio}× 20D avg',
  'tooltip.rsi': 'RSI',

  'ai.title': 'AI Analyst',
  'ai.subtitle': 'command interface',
  'ai.clear': 'Clear conversation',
  'ai.role': 'Analyst',
  'ai.empty.title': 'Describe what you want to see on the chart.',
  'ai.empty.body':
    'Conditions are compiled into a typed command and evaluated against the real candles — the model never invents dates or counts.',
  'ai.thinking': 'Interpreting…',
  'ai.placeholder': 'e.g. mark days that dropped more than 5%',
  'ai.disclaimer': 'Analysis tool, not investment advice.',
  'ai.send': 'Send',
  'ai.try': 'Try',
  'gallery.open': 'Command gallery',
  'gallery.title': 'Commands you can run right now',
  'gallery.subtitle': 'Every one of these runs on a single click, with no API key.',
  'gallery.search': 'Search commands…',
  'gallery.empty': 'No matching command.',
  'gallery.close': 'Close',
  'gallery.needsSignal': 'Needs an existing signal first',
  'gallery.count': '{count} commands',
  'gallery.seeAll': 'See all',
  'ai.error.network': 'Could not reach the analysis service. Check your connection and try again.',
  'ai.error.invalid': 'The response could not be validated, so nothing was applied to the chart.',
  'ai.error.status': 'Request failed ({status})',

  'result.matches': '{count} matches',

  'cmd.symbol': 'Symbol',
  'cmd.timeframe': 'Timeframe',
  'cmd.indicatorAdded': 'Indicator added',
  'cmd.indicatorRemoved': 'Indicator removed',
  'cmd.indicatorUpdated': 'Indicator updated',
  'cmd.nothingToRemove': 'Nothing to remove',
  'cmd.notOnChart': 'Not on the chart',
  'cmd.signalRemoved': 'Signal removed',
  'cmd.rangeHighlighted': 'Range highlighted',
  'cmd.priceLine': 'Price line',
  'cmd.zoomed': 'Zoomed',
  'cmd.cleared': 'Cleared',
  'cmd.levels': 'Support / resistance',
  'cmd.failed': 'Failed',

  'msg.noMatches': 'No bars matched this condition.',
  'msg.noLevels': 'No repeated levels found in this window.',
  'msg.noSignal': 'There is no signal to update yet.',
  'msg.badRange': 'Could not read that date range.',
  'msg.unexpected': 'The command could not be executed.',

  'reply.applied': 'Applied your request to the chart.',
  'reply.cleared': 'Cleared every signal and annotation.',
  'reply.help':
    'Demo Mode understands indicator, signal, and support/resistance commands. Try "add RSI" or "mark days that dropped more than 5% in the last year".',
  'reply.invalid':
    'I could not turn that into a valid chart command. Try naming the indicator or condition explicitly.',
  'reply.providerDown': 'The AI provider was unavailable, so the built-in parser handled it.',
  'reply.providerDownEmpty': 'The AI provider is unavailable right now. Please try again in a moment.',
  'reply.partial': '({count} command(s) were malformed and were not run.)',
}

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { ko, en }

/** English needs a singular form; Korean does not inflect for count. */
const EN_SINGULAR: Partial<Record<MessageKey, string>> = { 'result.matches': '{count} match' }

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

export function translator(locale: Locale): Translate {
  const table = MESSAGES[locale]
  return (key, params) => {
    let text: string = table[key]
    if (locale === 'en' && params?.count === 1 && EN_SINGULAR[key]) text = EN_SINGULAR[key]
    if (!params) return text
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    )
  }
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
