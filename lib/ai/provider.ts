import { extractPartialReply, readSseChunk } from './replyStream'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** Called with the reply text accumulated so far, each time it grows. */
export type ReplyProgress = (replySoFar: string) => void

export type LlmProvider = {
  id: string
  model: string
  /** Returns parsed JSON produced by the model. Throws on transport failure. */
  generateJson: (system: string, messages: ChatMessage[], onProgress?: ReplyProgress) => Promise<unknown>
}

export class LlmError extends Error {}

function env(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

/** Pulls the first balanced JSON object out of a model response. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  // Carry a snippet of what actually arrived — a bare "no JSON" is undebuggable.
  const snippet = `${cleaned.length} chars: ${JSON.stringify(cleaned.slice(0, 200))}`
  if (start === -1 || end <= start) throw new LlmError(`Model did not return JSON (${snippet})`)
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new LlmError(`Model returned malformed JSON (${snippet})`)
  }
}

/**
 * Streams a chat completion and reports the reply text as it is written.
 * Returns the full raw text once the stream ends.
 */
async function postSse(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  onProgress: ReplyProgress,
  pickDelta: (event: Record<string, unknown>) => string | undefined,
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '')
    throw new LlmError(`LLM request failed (${response.status}): ${detail.slice(0, 200)}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let raw = ''
  let lastReply = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    pending += decoder.decode(value, { stream: true })
    const { payloads, rest } = readSseChunk(pending)
    pending = rest
    for (const payload of payloads) {
      let event: Record<string, unknown>
      try {
        event = JSON.parse(payload) as Record<string, unknown>
      } catch {
        continue // a keep-alive or a payload we do not understand
      }
      const delta = pickDelta(event)
      if (!delta) continue
      raw += delta
      const reply = extractPartialReply(raw)
      if (reply !== lastReply) {
        lastReply = reply
        onProgress(reply)
      }
    }
  }

  if (!raw) throw new LlmError('Empty response from model')
  return raw
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new LlmError(`LLM request failed (${response.status}): ${detail.slice(0, 200)}`)
  }
  return response.json() as Promise<Record<string, unknown>>
}

type OpenAiShape = { choices?: Array<{ message?: { content?: string } }> }
type AnthropicShape = { content?: Array<{ text?: string }> }

function openAiCompatible(
  id: string,
  url: string,
  apiKey: string,
  model: string,
  extraHeaders: Record<string, string> = {},
  extraBody: Record<string, unknown> = {},
): LlmProvider {
  return {
    id,
    model,
    async generateJson(system, messages, onProgress) {
      const auth = { Authorization: `Bearer ${apiKey}`, ...extraHeaders }
      const body = {
        model,
        // Explicit so a runaway response cannot stall the request; a command
        // envelope is a few hundred tokens even with several clauses.
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, ...messages],
        ...extraBody,
      }

      const once = async () => {
        const payload = (await postJson(url, auth, body)) as OpenAiShape
        const content = payload.choices?.[0]?.message?.content
        if (!content) throw new LlmError('Empty response from model')
        return extractJson(content)
      }

      if (!onProgress) return once()

      const raw = await postSse(url, auth, { ...body, stream: true }, onProgress, (event) => {
        const choice = (event.choices as Array<{ delta?: { content?: string } }> | undefined)?.[0]
        return choice?.delta?.content
      })
      try {
        return extractJson(raw)
      } catch (error) {
        // A model that answered in prose will usually comply on a second ask.
        console.warn('[llm] non-JSON reply, retrying once:', (error as Error).message)
        return once()
      }
    },
  }
}

function anthropic(apiKey: string, model: string): LlmProvider {
  return {
    id: 'anthropic',
    model,
    async generateJson(system, messages, onProgress) {
      const auth = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      const body = { model, max_tokens: 2048, system, messages }

      if (onProgress) {
        const raw = await postSse(
          'https://api.anthropic.com/v1/messages',
          auth,
          { ...body, stream: true },
          onProgress,
          (event) =>
            event.type === 'content_block_delta'
              ? (event.delta as { text?: string } | undefined)?.text
              : undefined,
        )
        return extractJson(raw)
      }

      const payload = (await postJson(
        'https://api.anthropic.com/v1/messages',
        auth,
        body,
      )) as AnthropicShape
      const content = payload.content?.[0]?.text
      if (!content) throw new LlmError('Empty response from model')
      return extractJson(content)
    },
  }
}

/** Returns null when no API key is configured — the app then runs in Demo Mode. */
export function getLlmProvider(): LlmProvider | null {
  const preferred = env('LLM_PROVIDER')?.toLowerCase()
  const openaiKey = env('OPENAI_API_KEY')
  const anthropicKey = env('ANTHROPIC_API_KEY')
  const openrouterKey = env('OPENROUTER_API_KEY')

  const build = {
    openai: () =>
      openaiKey
        ? openAiCompatible('openai', 'https://api.openai.com/v1/chat/completions', openaiKey, env('OPENAI_MODEL') ?? 'gpt-4o-mini')
        : null,
    anthropic: () => (anthropicKey ? anthropic(anthropicKey, env('ANTHROPIC_MODEL') ?? 'claude-sonnet-5') : null),
    openrouter: () =>
      openrouterKey
        ? openAiCompatible(
            'openrouter',
            'https://openrouter.ai/api/v1/chat/completions',
            openrouterKey,
            env('OPENROUTER_MODEL') ?? 'z-ai/glm-5.3-flash',
            { 'X-Title': 'ChartPilot', 'HTTP-Referer': 'https://github.com/Haeseong-Kwon/stock-pilot' },
            {
              // Reasoning models default to their deepest setting. Translating a
              // sentence into a typed command does not need it: on GLM 5.3 Flash
              // `max` costs 22s and ~1,100 reasoning tokens, `low` 3.7s and ~24.
              reasoning: { effort: env('OPENROUTER_REASONING_EFFORT') ?? 'low' },
              // OpenRouter load-balances across upstreams, and several that serve
              // this model ignore `response_format` — landing on one produced prose
              // instead of JSON and silently dropped the request to the fallback
              // parser. Only route to upstreams that honour every parameter we send.
              provider: { require_parameters: true },
            },
          )
        : null,
  }

  if (preferred && preferred in build) {
    return build[preferred as keyof typeof build]()
  }
  return build.openai() ?? build.anthropic() ?? build.openrouter()
}
