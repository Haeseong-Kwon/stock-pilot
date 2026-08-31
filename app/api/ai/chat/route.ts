import { NextResponse } from 'next/server'
import {
  AiEnvelopeSchema,
  ChartCommandSchema,
  type ChartCommand,
} from '@/lib/schemas/chartCommand'
import { ChatRequestSchema, type ChartContext } from '@/lib/ai/context'
import { buildContextMessage, SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getLlmProvider } from '@/lib/ai/provider'
import { parseLocally } from '@/lib/ai/localParser'
import { translator, type Locale } from '@/lib/i18n/messages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Newline-delimited JSON. `reply` events carry the text written so far; exactly
 * one `done` event ends the stream and carries the validated commands.
 */
type StreamEvent =
  | { type: 'reply'; text: string }
  | { type: 'done'; reply: string; commands: ChartCommand[]; mode: string; failed?: boolean }

function ndjson(events: () => AsyncGenerator<StreamEvent>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events()) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        }
      } catch (error) {
        console.error('[api/ai/chat] stream failed:', error)
        const fallback: StreamEvent = {
          type: 'done',
          reply: 'The analysis service failed mid-response.',
          commands: [],
          mode: 'error',
          failed: true,
        }
        controller.enqueue(encoder.encode(`${JSON.stringify(fallback)}\n`))
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}

function localFallback(prompt: string, context: ChartContext, locale: Locale, emptyKey: 'reply.invalid' | 'reply.providerDownEmpty'): StreamEvent {
  const t = translator(locale)
  const parsed = parseLocally(prompt, context, locale)
  const suffix = emptyKey === 'reply.providerDownEmpty' ? ` ${t('reply.providerDown')}` : ''
  return {
    type: 'done',
    mode: 'fallback',
    commands: parsed.commands,
    reply: parsed.commands.length > 0 ? `${parsed.reply}${suffix}` : t(emptyKey),
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 })
  }

  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const { messages, context, locale } = parsed.data
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUser) return NextResponse.json({ error: 'No user message' }, { status: 400 })

  const provider = getLlmProvider()
  const t = translator(locale)

  return ndjson(async function* () {
    if (!provider) {
      const demo = parseLocally(lastUser.content, context, locale)
      yield { type: 'done', reply: demo.reply, commands: demo.commands, mode: 'demo' }
      return
    }

    // The model streams; buffer the deltas so they can be forwarded in order.
    const pending: string[] = []
    let notify: (() => void) | null = null
    let finished: { raw: unknown } | { error: unknown } | null = null

    const call = provider
      .generateJson(
        SYSTEM_PROMPT,
        [
          { role: 'user', content: `Chart state:\n${buildContextMessage(context, locale)}` },
          { role: 'assistant', content: '{"reply":"Understood — chart state noted.","commands":[]}' },
          ...messages,
        ],
        (replySoFar) => {
          pending.push(replySoFar)
          notify?.()
        },
      )
      .then((raw) => {
        finished = { raw }
      })
      .catch((error: unknown) => {
        finished = { error }
      })
      .finally(() => notify?.())

    while (!finished || pending.length > 0) {
      while (pending.length > 0) {
        const text = pending.shift()
        if (text !== undefined) yield { type: 'reply', text }
      }
      if (finished) break
      await new Promise<void>((resolve) => {
        notify = resolve
      })
      notify = null
    }
    await call

    const settled = finished as { raw: unknown } | { error: unknown }
    if ('error' in settled) {
      console.error('[api/ai/chat]', settled.error)
      yield localFallback(lastUser.content, context, locale, 'reply.providerDownEmpty')
      return
    }

    const envelope = AiEnvelopeSchema.safeParse(settled.raw)
    if (!envelope.success) {
      console.error('[api/ai/chat] envelope rejection:', envelope.error.issues.slice(0, 3))
      yield localFallback(lastUser.content, context, locale, 'reply.invalid')
      return
    }

    // Validate command by command: one malformed entry must not discard the rest.
    const commands: ChartCommand[] = []
    let dropped = 0
    for (const candidate of envelope.data.commands) {
      const command = ChartCommandSchema.safeParse(candidate)
      if (command.success) {
        commands.push(command.data)
      } else {
        dropped++
        // Serialize: console.error prints nested objects as [Object], which
        // makes a schema rejection impossible to diagnose from the log.
        const issue = command.error.issues[0]
        console.error(
          `[api/ai/chat] dropped command at ${issue?.path.join('.') || '(root)'}: ${issue?.message} — ${JSON.stringify(candidate)}`,
        )
      }
    }

    // Everything the model asked for was invalid — try the rule-based parser instead.
    if (commands.length === 0 && dropped > 0) {
      yield localFallback(lastUser.content, context, locale, 'reply.invalid')
      return
    }

    yield {
      type: 'done',
      reply:
        dropped > 0
          ? `${envelope.data.reply} ${t('reply.partial', { count: dropped })}`
          : envelope.data.reply,
      commands,
      mode: provider.id,
    }
  })
}
