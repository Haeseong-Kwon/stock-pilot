# ChartPilot

An AI-native financial chart. You describe what you want to see in plain language; a
deterministic analysis engine computes it and the chart changes.

The model never computes prices, dates, or counts. It only translates your request into a
typed `ChartCommand`, which is validated with Zod and executed against the real candles:

```
natural language → LLM intent parser → typed ChartCommand (Zod-validated)
                 → deterministic analysis engine → chart render
```

Same data + same condition always produces the same result.

## Quick start

```bash
npm install
cp .env.example .env.local     # optional — see AI providers below
npm run dev                    # http://localhost:3000
```

No API key is needed to try it. Without one the app runs in **Demo Mode**: real market data,
plus a rule-based intent parser that covers the documented example commands.

## Try these

| Prompt | What happens |
| --- | --- |
| `20일 이동평균선 추가해` | SMA(20) overlay |
| `RSI 보여줘` | RSI(14) in its own pane |
| `최근 1년간 5% 이상 떨어진 날 표시해` | markers on every bar with a 1-day return ≤ −5% |
| `그중 거래량이 두 배 이상 터진 것만 남겨` | rewrites the existing signal as an `AND` |
| `골든크로스 발생한 곳 표시` | SMA(50) crossing above SMA(200) |
| `볼린저밴드 아래로 이탈한 곳 보여줘` | close below the lower band |
| `최근 6개월 지지선과 저항선 찾아줘` | pivot-clustered horizontal levels |
| `2024년 1월부터 2025년 1월까지만 보여줘` | zooms the visible range |
| `전부 지워` | clears signals and annotations, keeps the candles |

English works too (`mark days that dropped more than 5% in the last year`) — the parser is
bilingual regardless of which interface language is selected.

Don't want to type? **Command gallery** in the AI panel header lists all 30 supported commands,
grouped and searchable, each one click away. `tests/catalogue.test.ts` runs every entry through
the parser and the executor in both languages, so a row can never advertise something the app
no longer does.

## Terminal controls

Modelled on what the large commercial platforms treat as table stakes:

| Control | Options |
| --- | --- |
| Chart type | Candles, hollow candles, bars, Heikin Ashi, line, area |
| Price scale | Normal, logarithmic, percent, indexed to 100 — applied to the **price pane only**, so a log axis never lands on MACD or a bounded oscillator |
| Range presets | 1M, 3M, 6M, YTD, 1Y, 5Y, ALL — presets the loaded history cannot fill are hidden |
| Data window | `D` — every series' value at the cursor, which the one-line legend stops being able to show once you have several indicators |
| Symbol stats | Day range, period range with a position marker, volume against its own average |
| Shortcuts | `⌘K` symbol search, `D` data window, `L` log scale |

The workspace — symbol, timeframe, chart type, scale, indicators, signals and recent symbols —
is written to `localStorage` and restored on the next visit. It is validated against a schema on
read, so a stale or hand-edited entry is dropped rather than half-restored, and **Reset workspace**
in the ⓘ menu clears it.

## Language

The interface ships in **Korean by default**, switchable to English from the ⓘ button in the top
right. The choice is stored in `localStorage` and survives a reload.

The selected locale is sent with every AI request, so replies come back in that language even when
you type in the other one. Strings live in one file — `lib/i18n/messages.ts` — and a test asserts
that every locale has the same keys and the same `{placeholders}`, so a missing translation fails
`npm test` rather than shipping as English fallback text.

Command results are stored as translation keys rather than rendered text, which is why switching
language relabels the existing conversation instead of leaving stale strings behind.

## Architecture

| Path | Responsibility |
| --- | --- |
| `lib/market/` | `MarketDataProvider` abstraction + Binance / Yahoo / synthetic implementations, TTL cache |
| `lib/analysis/indicators/` | 39 indicators as pure functions, plus the registry that describes them |
| `lib/analysis/statistics/` | returns, volatility, drawdown, z-score |
| `lib/analysis/signals/` | the condition DSL evaluator, crossovers, support/resistance |
| `lib/schemas/` | Zod schemas for the expression DSL and for every chart command |
| `lib/chart/` | command executor, indicator defaults, plot builders, condition descriptions |
| `lib/ai/` | provider layer, system prompt, demo-mode rule parser, command catalogue |
| `lib/i18n/` | message catalogue (ko/en) and the tiny interpolating translator |
| `stores/` | Zustand slices for chart state, conversation state and locale |
| `app/api/` | market data and AI endpoints (all external calls happen server-side) |

Indicator series are **derived**, never stored: the store holds definitions, and changing the
symbol or timeframe recomputes every indicator and re-evaluates every signal automatically.

### Indicators

Every indicator lives in one registry entry (`lib/analysis/indicators/registry.ts`) that declares
its parameters, output series, pane, value range and search aliases. The schema, the chart
renderer, the indicator menu, the rule-based parser and the AI system prompt are all **generated
from it** — adding an indicator means adding one table row and one pure function, not editing six
files that then drift apart.

| Category | Indicators |
| --- | --- |
| Trend | SMA, EMA, WMA, HMA, DEMA, TEMA, VWMA, VWAP, SuperTrend, Parabolic SAR, Ichimoku, ADX/DMI, Aroon, Vortex |
| Momentum | RSI, MACD, Stochastic, Stochastic RSI, CCI, Williams %R, ROC, Momentum, TRIX, PPO, DPO, Awesome, Ultimate, Elder Ray |
| Volatility | Bollinger, Keltner, Donchian, Choppiness, ATR, NATR, Volatility, StdDev, BB Width, Drawdown |
| Volume | Volume SMA, OBV, MFI, CMF, A/D Line, Chaikin Osc, Force Index, Ease of Movement, Volume Oscillator |

All of them are usable **inside signal conditions**, not just as chart overlays, through the
`INDICATOR` expression node:

```jsonc
{ "type": "CROSS_ABOVE",
  "left":  { "type": "INDICATOR", "name": "STOCH", "params": { "period": 14 }, "output": "k" },
  "right": 20 }
```

### The signal DSL

Conditions are a small AST, not free text:

```jsonc
{
  "type": "AND",
  "conditions": [
    { "type": "COMPARE", "left": { "type": "RSI", "period": 14 }, "operator": "<=", "right": 30 },
    { "type": "COMPARE", "left": { "type": "VOLUME" }, "operator": ">=",
      "right": { "type": "MULTIPLY", "left": { "type": "VOLUME_SMA", "period": 20 }, "right": 2 } }
  ]
}
```

Nodes: `AND OR NOT COMPARE CROSS_ABOVE CROSS_BELOW` over
`OPEN HIGH LOW CLOSE VOLUME RETURN SMA EMA RSI MACD ATR BOLLINGER VOLUME_SMA VOLATILITY DRAWDOWN`
plus `ADD SUBTRACT MULTIPLY DIVIDE ABS LAG`. Returns are fractions (`-0.05`, not `-5`).

`LAG` is the lookback primitive — the value a node had N bars ago. "Three down days in a row" is
one clause per bar:

```jsonc
{ "type": "AND", "conditions": [
  { "type": "COMPARE", "left": { "type": "RETURN", "period": 1 }, "operator": "<", "right": 0 },
  { "type": "COMPARE", "left": { "type": "LAG", "value": { "type": "RETURN", "period": 1 }, "bars": 1 }, "operator": "<", "right": 0 },
  { "type": "COMPARE", "left": { "type": "LAG", "value": { "type": "RETURN", "period": 1 }, "bars": 2 }, "operator": "<", "right": 0 }
]}
```

## AI providers

```bash
cp .env.example .env.local   # then paste your key
```

If no key is set, Demo Mode is used. `.env.local` is gitignored.

| `LLM_PROVIDER` | Key | Model variable (default) |
| --- | --- | --- |
| `openrouter` **(default)** | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` (`z-ai/glm-5.3-flash`) |
| `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` (`gpt-5-nano`) |
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` (`claude-haiku-4-5`) |

**Why GLM 5.3 Flash by default:** this is constrained translation into a fixed grammar, not
open-ended reasoning — the DSL is spelled out in the prompt and every response is Zod-validated
before anything touches the chart. At $0.075/$0.25 per 1M tokens the workload (~1.5K in, ~0.3K out)
costs about **$0.0002 per request** — roughly 16× cheaper than Claude Haiku 4.5 and 32× cheaper
than Sonnet 5 for the same job. Swap `OPENROUTER_MODEL` for any other id to compare.

No `temperature` is sent: several current models (`gpt-5-*`, `claude-sonnet-5`, `claude-opus-5`)
reject the parameter outright, and schema validation makes it redundant here.

**Reasoning effort.** GLM 5.3 Flash has mandatory reasoning that defaults to `max`, which is wildly
overkill for translating one sentence into a typed command. Measured on the real prompt:

| effort | latency | reasoning tokens | cost/request |
| --- | --- | --- | --- |
| `max` (provider default) | 22.1s | 1,124 | $0.00041 |
| `high` | 7.6s | 70 | $0.00015 |
| **`low` (what we send)** | **3.7s** | 24 | **$0.00014** |

Override with `OPENROUTER_REASONING_EFFORT`. If you switch to a non-reasoning model the parameter
is simply ignored.

Commands are validated **one at a time**, so a single malformed command cannot discard the valid
ones next to it; anything rejected is reported in the reply and never reaches the chart.

**Upstream routing.** OpenRouter load-balances one model across many upstream providers, and not
all of them honour `response_format` — landing on one produced prose instead of JSON and silently
dropped the request to the rule-based parser (3 of the 21 upstreams serving GLM 5.3 Flash lack it).
Requests therefore pin `provider: { require_parameters: true }`.

**Unusable JSON.** Perhaps twice in a hundred calls the model closes the object one brace too many
or drops a bracket. Two defences: the extractor takes the first *balanced* object rather than
slicing to the last `}`, and anything still unparseable is asked again once (both the streaming and
non-streaming paths, and the eval harness, so the measured rate is the one users get).

Providers are plain `fetch` calls behind one `LlmProvider` interface (`lib/ai/provider.ts`); no
vendor SDK leaks into the rest of the app. If the model returns something that fails Zod
validation, **nothing is executed** — the request falls back to the rule-based parser.

## Market data providers

| Provider | Used for | Timeframes |
| --- | --- | --- |
| Binance public API | symbols ending in USDT/USDC/BTC/ETH | 1m 5m 15m 1h 4h 1D 1W |
| Yahoo Finance chart endpoint | equities and ETFs | 1m 5m 15m 1h 1D 1W |
| Synthetic | automatic fallback when a provider fails | all |

> **Production note:** the Yahoo chart endpoint is undocumented and unsupported for commercial
> use. It sits behind `MarketDataProvider` precisely so it can be swapped for a licensed feed
> (Polygon, Tiingo, Alpaca…) by adding one file in `lib/market/providers/`.

When live data cannot be fetched, the app serves deterministic synthetic candles and shows a
**Demo data** badge rather than an empty chart.

## Streaming

`/api/ai/chat` answers with newline-delimited JSON: `reply` events carry the text as the model
writes it, and a single `done` event carries the Zod-validated commands. The chart only changes on
`done` — a half-written command is never executed. Demo Mode emits one `done` event and nothing
else, so the client has a single code path.

A reasoning model produces no output for the first several seconds, so the pending message shows a
live elapsed counter rather than a static spinner.

## Model evaluation

`tests/eval/` is a bake-off harness over 38 golden cases — the 30 gallery prompts plus 8 that the
rule-based parser could not express. It reports accuracy, latency and real cost per model:

```bash
npm run eval                                                   # the configured model
npm run eval -- --models z-ai/glm-5.3-flash,openai/gpt-5-mini  # compare
npm run eval -- --effort high --limit 10
```

It spends real money (about $0.002 per model per run at GLM prices), which is why it is not part of
`npm test`. Cases assert command *types* and required substrings, and accept equivalent answers
where more than one command sequence reaches the same chart state.

Last run (47 cases, `effort=low`):

| model | accuracy | p50 | p95 | cost/request |
| --- | --- | --- | --- | --- |
| `z-ai/glm-5.3-flash` **(default)** | 47/47 | 1,476ms | 3,795ms | **$0.00006** |

An earlier 38-case run also had `openai/gpt-5-mini` (38/38, p50 497ms, $0.00074) and
`deepseek/deepseek-v4-flash` (38/38, p50 1,730ms, $0.00019) at 100%.

All three are correct on every case, so the default is the cheapest of them — GLM is 15× cheaper
than gpt-5-mini, which in turn is about 2× faster. Note that a set every candidate aces no longer
discriminates: harder cases are needed before this table can pick a winner on quality again.

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build (writes .next)
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest — 236 unit tests
npm run test:e2e    # playwright browser smoke test (needs a running server)
npm run eval        # model bake-off against 38 golden cases (spends money)
```

`next build` and `next dev` share `.next`, so building while the dev server is up corrupts its
chunks (`__webpack_modules__[moduleId] is not a function`). To verify a build without stopping
`npm run dev`, send it somewhere else:

```bash
NEXT_DIST_DIR=.next-verify npm run build
```

## Known limitations

- Intraday equity history is short (Yahoo caps 1m at 7 days, 5m/15m at 60 days); 4h is crypto-only.
- Support/resistance is pivot clustering with a touch count — no regression channels or volume profile.
- Conversation context sent to the model is a summary (symbol, timeframe, active indicators and
  signals). Raw candles are never uploaded.
- Signal match counts reported in chat are computed against the candles loaded at that moment; if a
  command also switches symbol, the chart re-evaluates but the chat line keeps the older count.
- `UPDATE_INDICATOR` is the one command the demo parser does not emit (it collides with the
  "RSI 30" threshold rule); edit a period inline on its chart badge instead. With an LLM connected
  it works normally.
- LLM latency is variable — typically 1-6s, occasionally 15s+. The reply streams as it is written,
  but the reasoning phase before it produces nothing, so the first seconds show only the counter.
- The DSL has no ranking operator, so "the most volatile month" cannot be expressed. The model is
  instructed to say so rather than invent a date range — inventing one is the failure mode the
  whole architecture exists to prevent, and the eval suite asserts it does not happen.
- No backtesting, no order routing, no portfolio. The command/executor split is designed to make
  backtesting an additive change, but it is not implemented.
- Desktop-first (≥1440px). The layout degrades gracefully but is not optimised for mobile.

For research and education only. This is not investment advice.
