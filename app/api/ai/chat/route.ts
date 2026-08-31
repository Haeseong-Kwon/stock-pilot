import { NextResponse } from 'next/server'
import { AiEnvelopeSchema, ChartCommandSchema, type ChartCommand } from '@/lib/schemas/chartCommand'
import { ChatRequestSchema } from '@/lib/ai/context'
import { buildContextMessage, SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getLlmProvider } from '@/lib/ai/provider'
import { parseLocally } from '@/lib/ai/localParser'
import { translator } from '@/lib/i18n/messages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  const t = translator(locale)
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUser) return NextResponse.json({ error: 'No user message' }, { status: 400 })

  const provider = getLlmProvider()
  if (!provider) {
    return NextResponse.json({ ...parseLocally(lastUser.content, context, locale), mode: 'demo' })
  }

  try {
    const raw = await provider.generateJson(SYSTEM_PROMPT, [
      { role: 'user', content: `Chart state:\n${buildContextMessage(context, locale)}` },
      { role: 'assistant', content: '{"reply":"Understood — chart state noted.","commands":[]}' },
      ...messages,
    ])
    const envelope = AiEnvelopeSchema.safeParse(raw)
    if (!envelope.success) {
      console.error('[api/ai/chat] envelope rejection:', envelope.error.issues.slice(0, 3))
      const fallback = parseLocally(lastUser.content, context, locale)
      return NextResponse.json({
        ...fallback,
        reply: fallback.commands.length > 0 ? fallback.reply : t('reply.invalid'),
        mode: 'fallback',
      })
    }

    // Validate command by command: one malformed entry must not discard the rest.
    const commands: ChartCommand[] = []
    let dropped = 0
    for (const candidate of envelope.data.commands) {
      const parsed = ChartCommandSchema.safeParse(candidate)
      if (parsed.success) {
        commands.push(parsed.data)
      } else {
        dropped++
        console.error('[api/ai/chat] dropped command:', parsed.error.issues[0]?.message, candidate)
      }
    }

    // Everything the model asked for was invalid — try the rule-based parser instead.
    if (commands.length === 0 && dropped > 0) {
      const fallback = parseLocally(lastUser.content, context, locale)
      return NextResponse.json({
        ...fallback,
        reply: fallback.commands.length > 0 ? fallback.reply : t('reply.invalid'),
        mode: 'fallback',
      })
    }

    return NextResponse.json({
      reply: dropped > 0 ? `${envelope.data.reply} ${t('reply.partial', { count: dropped })}` : envelope.data.reply,
      commands,
      mode: provider.id,
    })
  } catch (error) {
    console.error('[api/ai/chat]', error)
    const fallback = parseLocally(lastUser.content, context, locale)
    return NextResponse.json({
      ...fallback,
      reply:
        fallback.commands.length > 0
          ? `${fallback.reply} ${t('reply.providerDown')}`
          : t('reply.providerDownEmpty'),
      mode: 'fallback',
    })
  }
}
