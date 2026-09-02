import { describe, expect, it } from 'vitest'
import { summarizeResults } from '@/lib/chart/summarize'
import { translator } from '@/lib/i18n/messages'
import type { CommandResult } from '@/lib/chart/commandExecutor'

const ko = translator('ko')
const en = translator('en')

describe('summarizeResults', () => {
  it('states the match count the model never saw', () => {
    const results: CommandResult[] = [
      { type: 'CREATE_SIGNAL', label: '5% 이상 하락', count: 7, status: 'ok' },
    ]
    expect(summarizeResults(results, ko)).toBe('“5% 이상 하락” 조건에 7개 봉이 일치합니다.')
    expect(summarizeResults(results, en)).toBe('7 bars match “5% 이상 하락”.')
  })

  it('reports zero matches too — an empty result is still an answer', () => {
    const results: CommandResult[] = [
      { type: 'CREATE_SIGNAL', label: 'Impossible', count: 0, status: 'empty' },
    ]
    expect(summarizeResults(results, en)).toContain('0 bars')
  })

  it('combines several findings into one line', () => {
    const summary = summarizeResults(
      [
        { type: 'DRAW_TRENDLINE', labelKey: 'cmd.trendline', count: 2, detail: 'resistance · 4 touches', status: 'ok' },
        { type: 'FIND_PATTERNS', labelKey: 'cmd.patterns', count: 1, detail: 'doubleTop', status: 'ok' },
      ],
      en,
    )!
    expect(summary).toContain('2 trendline')
    expect(summary).toContain('1 pattern')
  })

  it('says nothing when there is nothing to report', () => {
    expect(summarizeResults([], en)).toBeNull()
    expect(summarizeResults([{ type: 'SET_SYMBOL', labelKey: 'cmd.symbol', status: 'ok' }], en)).toBeNull()
  })

  it('skips failures, which the result card already shows', () => {
    expect(
      summarizeResults(
        [{ type: 'DRAW_TRENDLINE', labelKey: 'cmd.failed', status: 'error', messageKey: 'msg.badRange' }],
        en,
      ),
    ).toBeNull()
  })

  it('omits a drawing that found nothing', () => {
    expect(
      summarizeResults(
        [{ type: 'FIND_PATTERNS', labelKey: 'cmd.patterns', count: 0, status: 'empty' }],
        en,
      ),
    ).toBeNull()
  })
})
