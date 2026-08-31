export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type LlmProvider = {
  id: string
  model: string
  /** Returns parsed JSON produced by the model. Throws on transport failure. */
  generateJson: (system: string, messages: ChatMessage[]) => Promise<unknown>
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
  if (start === -1 || end <= start) throw new LlmError('Model did not return JSON')
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new LlmError('Model returned malformed JSON')
  }
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
    async generateJson(system, messages) {
      const payload = (await postJson(
        url,
        { Authorization: `Bearer ${apiKey}`, ...extraHeaders },
        {
          model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, ...messages],
          ...extraBody,
        },
      )) as OpenAiShape
      const content = payload.choices?.[0]?.message?.content
      if (!content) throw new LlmError('Empty response from model')
      return extractJson(content)
    },
  }
}

function anthropic(apiKey: string, model: string): LlmProvider {
  return {
    id: 'anthropic',
    model,
    async generateJson(system, messages) {
      const payload = (await postJson(
        'https://api.anthropic.com/v1/messages',
        { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        {
          model,
          max_tokens: 2048,
          system,
          messages,
        },
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
            // Reasoning models default to their deepest setting. Translating a
            // sentence into a typed command does not need it: on GLM 5.3 Flash
            // `max` costs 22s and ~1,100 reasoning tokens, `low` 3.7s and ~24.
            { reasoning: { effort: env('OPENROUTER_REASONING_EFFORT') ?? 'low' } },
          )
        : null,
  }

  if (preferred && preferred in build) {
    return build[preferred as keyof typeof build]()
  }
  return build.openai() ?? build.anthropic() ?? build.openrouter()
}
