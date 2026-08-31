import { describe, expect, it } from 'vitest'
import { extractPartialReply, readSseChunk } from '@/lib/ai/replyStream'

describe('extractPartialReply', () => {
  it('returns nothing before the key arrives', () => {
    expect(extractPartialReply('{"comm')).toBe('')
    expect(extractPartialReply('')).toBe('')
  })

  it('reads a reply that is still being written', () => {
    expect(extractPartialReply('{"reply":"RSI를 추')).toBe('RSI를 추')
  })

  it('stops at the closing quote', () => {
    expect(extractPartialReply('{"reply":"done","commands":[]}')).toBe('done')
  })

  it('decodes escapes', () => {
    expect(extractPartialReply('{"reply":"a\\nb"')).toBe('a\nb')
    expect(extractPartialReply('{"reply":"say \\"hi\\""')).toBe('say "hi"')
    expect(extractPartialReply('{"reply":"back\\\\slash"')).toBe('back\\slash')
    expect(extractPartialReply('{"reply":"\\uAC00"')).toBe('가')
  })

  it('does not emit a half-written escape sequence', () => {
    expect(extractPartialReply('{"reply":"a\\')).toBe('a')
    expect(extractPartialReply('{"reply":"a\\u12')).toBe('a')
  })

  it('grows monotonically as chunks arrive', () => {
    const full = '{"reply":"차트에 적용했습니다.","commands":[]}'
    let previous = ''
    for (let i = 1; i <= full.length; i++) {
      const partial = extractPartialReply(full.slice(0, i))
      expect(partial.startsWith(previous) || previous.startsWith(partial)).toBe(true)
      previous = partial
    }
    expect(previous).toBe('차트에 적용했습니다.')
  })
})

describe('readSseChunk', () => {
  it('extracts complete data lines', () => {
    const { payloads, rest } = readSseChunk('data: {"a":1}\n\ndata: {"b":2}\n\n')
    expect(payloads).toEqual(['{"a":1}', '{"b":2}'])
    expect(rest).toBe('')
  })

  it('keeps an unfinished line for the next chunk', () => {
    const { payloads, rest } = readSseChunk('data: {"a":1}\n\ndata: {"b":')
    expect(payloads).toEqual(['{"a":1}'])
    expect(rest).toBe('data: {"b":')
  })

  it('ignores comments, blank lines and the terminator', () => {
    const { payloads } = readSseChunk(': keep-alive\n\ndata: [DONE]\n\n')
    expect(payloads).toEqual([])
  })
})
