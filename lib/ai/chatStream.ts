import type { ChartCommand } from '@/lib/schemas/chartCommand'

export type ChatStreamEvent =
  | { type: 'reply'; text: string }
  | { type: 'done'; reply: string; commands: ChartCommand[]; mode: string; failed?: boolean }

/** Yields the newline-delimited JSON events produced by /api/ai/chat. */
export async function* readChatStream(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    pending += decoder.decode(value, { stream: true })

    for (;;) {
      const boundary = pending.indexOf('\n')
      if (boundary === -1) break
      const line = pending.slice(0, boundary).trim()
      pending = pending.slice(boundary + 1)
      if (!line) continue
      try {
        yield JSON.parse(line) as ChatStreamEvent
      } catch {
        // A truncated line can only happen if the stream died mid-write; skip it.
      }
    }
  }

  const tail = pending.trim()
  if (tail) {
    try {
      yield JSON.parse(tail) as ChatStreamEvent
    } catch {
      // Ignore an incomplete trailing event.
    }
  }
}
