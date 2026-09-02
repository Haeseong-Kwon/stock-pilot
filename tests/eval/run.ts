/**
 * Model bake-off. Runs every golden case against one or more OpenRouter models
 * and reports accuracy, latency and real cost.
 *
 *   npm run eval                                  # the configured model
 *   npm run eval -- --models z-ai/glm-5.3-flash,openai/gpt-5-mini
 *   npm run eval -- --effort high --limit 10
 *
 * This spends money on every run, which is why it is not part of `npm test`.
 */
import { ChartCommandSchema, AiEnvelopeSchema, type ChartCommand } from '@/lib/schemas/chartCommand'
import { SYSTEM_PROMPT, buildContextMessage } from '@/lib/ai/prompts'
import { extractJson } from '@/lib/ai/provider'
import type { ChartContext } from '@/lib/ai/context'
import { EVAL_CASES, type EvalCase } from './cases'

const KEY = process.env.OPENROUTER_API_KEY
if (!KEY) {
  console.error('OPENROUTER_API_KEY is not set. Put it in .env.local and run with:')
  console.error('  node --env-file=.env.local ...  (npm run eval does this for you)')
  process.exit(1)
}

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

const MODELS = arg('models', process.env.OPENROUTER_MODEL ?? 'z-ai/glm-5.3-flash').split(',')
const EFFORT = arg('effort', process.env.OPENROUTER_REASONING_EFFORT ?? 'low')
const LIMIT = Number(arg('limit', String(EVAL_CASES.length)))
const CASES = EVAL_CASES.slice(0, LIMIT)

const baseContext: ChartContext = {
  symbol: 'BTCUSDT',
  timeframe: '1D',
  barCount: 1000,
  firstBarDate: '2023-06-01',
  lastBarDate: '2026-02-20',
  lastPrice: 78000,
  indicators: [],
  signals: [],
  drawings: [],
}

const withIndicator: ChartContext = {
  ...baseContext,
  indicators: [{ type: 'SMA', params: { period: 20 } }],
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

type Outcome = {
  id: string
  pass: boolean
  reason: string
  ms: number
  cost: number
  /** True when the first answer was unusable JSON and the retry saved it. */
  retried?: boolean
}

async function runCase(model: string, testCase: EvalCase, retry = true): Promise<Outcome> {
  const base = testCase.needsSignal
    ? withSignal
    : testCase.needsIndicator
      ? withIndicator
      : baseContext
  const context: ChartContext = { ...base, drawings: testCase.existingDrawings ?? [] }

  // Replay the earlier turns so the model sees the conversation it would have.
  const history = (testCase.priorTurns ?? []).flatMap((turn, index) => [
    { role: 'user' as const, content: turn },
    {
      role: 'assistant' as const,
      // A realistic prior turn did something; a canned empty list is exactly
      // what taught the model to stop acting.
      content: JSON.stringify({
        reply: '적용했습니다.',
        commands: [(testCase.priorCommands ?? [])[index] ?? { type: 'ADD_INDICATOR', indicator: 'RSI' }],
      }),
    },
  ])
  const started = Date.now()
  let cost = 0

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'ChartPilot eval',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
        reasoning: { effort: EFFORT },
        usage: { include: true },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Chart state:\n${buildContextMessage(context, 'ko')}` },
          { role: 'assistant', content: '{"reply":"Understood — chart state noted.","commands":[]}' },
          ...history,
          { role: 'user', content: testCase.prompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    })

    const ms = Date.now() - started
    const payload = (await response.json()) as {
      error?: { message?: string }
      usage?: { cost?: number }
      choices?: Array<{ message?: { content?: string } }>
    }
    cost = payload.usage?.cost ?? 0

    if (payload.error) return { id: testCase.id, pass: false, reason: `api: ${payload.error.message}`, ms, cost }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return { id: testCase.id, pass: false, reason: 'empty response', ms, cost }

    let raw: unknown
    try {
      raw = extractJson(content)
    } catch (error) {
      // The app retries an unusable JSON reply, so the eval must too or it
      // measures something users never experience.
      if (!retry) throw error
      const second = await runCase(model, testCase, false)
      return { ...second, retried: true, cost: second.cost + cost, ms: second.ms + ms }
    }

    const envelope = AiEnvelopeSchema.safeParse(raw)
    if (!envelope.success) return { id: testCase.id, pass: false, reason: 'bad envelope', ms, cost }

    const commands: ChartCommand[] = []
    const invalid: string[] = []
    for (const candidate of envelope.data.commands) {
      const parsed = ChartCommandSchema.safeParse(candidate)
      if (parsed.success) commands.push(parsed.data)
      else invalid.push(`${JSON.stringify(candidate).slice(0, 90)} — ${parsed.error.issues[0]?.message}`)
    }
    const invalidNote = invalid.length > 0 ? ` | invalid: ${invalid.join(' ; ')}` : ''

    const produced = commands.map((c) => c.type)

    if (testCase.expectRefusal && commands.length > 0) {
      return { id: testCase.id, pass: false, reason: `expected no command, got ${produced.join(',')}`, ms, cost }
    }

    const forbidden = (testCase.forbid ?? []).filter((type) => produced.includes(type))
    if (forbidden.length > 0) {
      return { id: testCase.id, pass: false, reason: `must not emit ${forbidden.join(',')}`, ms, cost }
    }

    const missing = testCase.expect.filter((type) => !produced.includes(type))
    if (missing.length > 0) {
      return { id: testCase.id, pass: false, reason: `missing ${missing.join(',')} (got ${produced.join(',') || 'none'})${invalidNote}`, ms, cost }
    }

    const alternatives = testCase.expectOneOf
    if (alternatives && !alternatives.some((group) => group.every((type) => produced.includes(type)))) {
      const wanted = alternatives.map((group) => group.join('+')).join(' or ')
      return { id: testCase.id, pass: false, reason: `wanted ${wanted}, got ${produced.join(',') || 'none'}${invalidNote}`, ms, cost }
    }

    const serialized = JSON.stringify(commands)
    const absent = (testCase.contains ?? []).filter((needle) => !serialized.includes(needle))
    if (absent.length > 0) {
      return { id: testCase.id, pass: false, reason: `missing ${absent.join(' ')}${invalidNote}`, ms, cost }
    }

    return { id: testCase.id, pass: true, reason: produced.join(','), ms, cost }
  } catch (error) {
    return {
      id: testCase.id,
      pass: false,
      reason: error instanceof Error ? error.message : 'unknown error',
      ms: Date.now() - started,
      cost,
    }
  }
}

/** Small concurrency so a slow model does not make the run take an hour. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const index = cursor++
        const item = items[index]
        if (item === undefined) return
        results[index] = await fn(item)
      }
    }),
  )
  return results
}

for (const model of MODELS) {
  console.log(`\n═══ ${model}  (effort=${EFFORT}, ${CASES.length} cases) ═══`)
  const outcomes = await mapLimit(CASES, 4, (testCase) => runCase(model, testCase))

  for (const outcome of outcomes.filter((o) => !o.pass)) {
    console.log(`  ✗ ${outcome.id.padEnd(28)} ${outcome.reason}`)
  }

  const passed = outcomes.filter((o) => o.pass).length
  const latencies = outcomes.map((o) => o.ms).sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length / 2)] ?? 0
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0
  const cost = outcomes.reduce((sum, o) => sum + o.cost, 0)
  const retried = outcomes.filter((o) => o.retried).length

  console.log(
    `  ${passed}/${outcomes.length} pass (${((passed / outcomes.length) * 100).toFixed(1)}%)  ` +
      `p50 ${p50}ms  p95 ${p95}ms  $${cost.toFixed(4)} total  $${(cost / outcomes.length).toFixed(5)}/req` +
      (retried > 0 ? `  · ${retried} needed a JSON retry` : ''),
  )
}
