import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractJson, getLlmProvider, LlmError } from '@/lib/ai/provider'

const KEYS = ['LLM_PROVIDER', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function onlyEnv(vars: Record<string, string>) {
  for (const key of KEYS) vi.stubEnv(key, '')
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value)
}

describe('getLlmProvider', () => {
  it('returns null with no keys, so the app stays in Demo Mode', () => {
    onlyEnv({})
    expect(getLlmProvider()).toBeNull()
  })

  it('selects OpenRouter and defaults to GLM 5.3 Flash', () => {
    onlyEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-v1-test' })
    const provider = getLlmProvider()
    expect(provider?.id).toBe('openrouter')
    expect(provider?.model).toBe('z-ai/glm-5.3-flash')
  })

  it('honours an explicit model override', () => {
    onlyEnv({
      LLM_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'sk-or-v1-test',
      OPENROUTER_MODEL: 'moonshotai/kimi-k2.5',
    })
    expect(getLlmProvider()?.model).toBe('moonshotai/kimi-k2.5')
  })

  it('ignores a blank key rather than sending an unauthenticated request', () => {
    onlyEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: '   ' })
    expect(getLlmProvider()).toBeNull()
  })

  it('falls back to whichever key is present when LLM_PROVIDER is unset', () => {
    onlyEnv({ OPENROUTER_API_KEY: 'sk-or-v1-test' })
    expect(getLlmProvider()?.id).toBe('openrouter')
  })

  it('sends no temperature — several current models reject it', async () => {
    onlyEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-v1-test' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"reply":"ok","commands":[]}' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await getLlmProvider()!.generateJson('sys', [{ role: 'user', content: 'hi' }])

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body).not.toHaveProperty('temperature')
    expect(body.model).toBe('z-ai/glm-5.3-flash')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' })
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer sk-or-v1-test')
  })

  it('surfaces a provider error instead of hanging', async () => {
    onlyEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-v1-bad' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'No auth credentials found' }),
    )
    await expect(
      getLlmProvider()!.generateJson('sys', [{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(LlmError)
  })
})

describe('extractJson', () => {
  it('reads a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('strips markdown fences that small models like to add', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('ignores prose around the object', () => {
    expect(extractJson('Sure!\n{"a":1}\nHope that helps.')).toEqual({ a: 1 })
  })

  it('throws on a response with no object at all', () => {
    expect(() => extractJson('I cannot do that')).toThrow(LlmError)
  })

  it('throws on malformed JSON rather than returning junk', () => {
    expect(() => extractJson('{"a": }')).toThrow(LlmError)
  })
})

describe('OpenRouter request shaping', () => {
  it('pins routing to upstreams that honour every parameter we send', async () => {
    onlyEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-v1-test' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"reply":"ok","commands":[]}' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await getLlmProvider()!.generateJson('sys', [{ role: 'user', content: 'hi' }])

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    // Several upstreams serving this model ignore response_format; without this
    // the model answers in prose and the request silently degrades.
    expect(body.provider).toEqual({ require_parameters: true })
    expect(body.reasoning).toEqual({ effort: 'low' })
    expect(body.max_tokens).toBe(2048)
  })

  it('retries once, without streaming, when the reply is not JSON', async () => {
    onlyEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-v1-test' })
    const sse = [
      'data: {"choices":[{"delta":{"content":"I cannot do that."}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    const fetchMock = vi
      .fn()
      // First call streams prose — no JSON anywhere in it.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          getReader: () => {
            let i = 0
            return {
              read: async () =>
                i < sse.length
                  ? { done: false, value: new TextEncoder().encode(sse[i++]) }
                  : { done: true, value: undefined },
            }
          },
        },
      })
      // The retry complies.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"reply":"ok","commands":[]}' } }] }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getLlmProvider()!.generateJson('sys', [{ role: 'user', content: 'hi' }], () => {})

    expect(result).toEqual({ reply: 'ok', commands: [] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).stream).toBe(true)
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).stream).toBeUndefined()
  })
})
