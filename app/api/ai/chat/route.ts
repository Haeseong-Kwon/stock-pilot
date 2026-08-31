import { NextResponse } from 'next/server'
import { AiResponseSchema } from '@/lib/schemas/chartCommand'
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
    const validated = AiResponseSchema.safeParse(raw)
    if (!validated.success) {
      console.error('[api/ai/chat] schema rejection:', validated.error.issues.slice(0, 3))
      // The model produced something we cannot safely execute — never run it.
      const fallback = parseLocally(lastUser.content, context, locale)
      return NextResponse.json({
        ...fallback,
        reply: fallback.commands.length > 0 ? fallback.reply : t('reply.invalid'),
        mode: 'fallback',
      })
    }
    return NextResponse.json({ ...validated.data, mode: provider.id })
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
