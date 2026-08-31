/**
 * The model streams one JSON object, so the visible reply only exists as a
 * partially written string inside it. This reads whatever of `"reply"` has
 * arrived so far, tolerating chunk boundaries that split an escape sequence.
 */
export function extractPartialReply(buffer: string): string {
  const key = /"reply"\s*:\s*"/.exec(buffer)
  if (!key) return ''

  let index = key.index + key[0].length
  let out = ''

  while (index < buffer.length) {
    const char = buffer[index]
    if (char === '"') break // closing quote — the reply is complete
    if (char !== '\\') {
      out += char
      index += 1
      continue
    }

    const escape = buffer[index + 1]
    if (escape === undefined) break // backslash was the last byte of this chunk
    if (escape === 'u') {
      const hex = buffer.slice(index + 2, index + 6)
      if (hex.length < 4) break // \uXXXX split across chunks
      const code = Number.parseInt(hex, 16)
      if (Number.isNaN(code)) break
      out += String.fromCharCode(code)
      index += 6
      continue
    }
    out += UNESCAPE[escape] ?? escape
    index += 2
  }

  return out
}

const UNESCAPE: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
}

/**
 * Splits a Server-Sent Events body into payloads. Returns the parsed `data:`
 * values plus whatever trailing bytes belong to an unfinished event.
 */
export function readSseChunk(pending: string): { payloads: string[]; rest: string } {
  const payloads: string[] = []
  let rest = pending

  for (;;) {
    const boundary = rest.indexOf('\n')
    if (boundary === -1) break
    const line = rest.slice(0, boundary).trim()
    rest = rest.slice(boundary + 1)
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (payload && payload !== '[DONE]') payloads.push(payload)
  }

  return { payloads, rest }
}
