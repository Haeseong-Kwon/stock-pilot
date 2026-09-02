import type { Translate } from '@/lib/i18n/messages'
import type { CommandResult } from './commandExecutor'

/**
 * A one-line account of what the engine actually found, written by the engine.
 * The model streams its reply before any command runs, so it cannot report
 * touch counts or match counts — and must not guess them. This says the numbers
 * out loud without putting them in the model's mouth.
 */
export function summarizeResults(results: CommandResult[], t: Translate): string | null {
  const parts: string[] = []

  for (const result of results) {
    if (result.status === 'error') continue
    const count = result.count ?? 0

    switch (result.type) {
      case 'CREATE_SIGNAL':
      case 'UPDATE_SIGNAL':
        parts.push(t('summary.signal', { name: result.label ?? '', count }))
        break
      case 'DRAW_TRENDLINE':
        if (count > 0) parts.push(t('summary.trendline', { count, detail: result.detail ?? '' }))
        break
      case 'DRAW_FIBONACCI':
        if (count > 0) parts.push(t('summary.fibonacci', { count }))
        break
      case 'FIND_SUPPORT_RESISTANCE':
        if (count > 0) parts.push(t('summary.levels', { count }))
        break
      case 'FIND_PATTERNS':
        if (count > 0) parts.push(t('summary.patterns', { count, detail: result.detail ?? '' }))
        break
      case 'DRAW_REGRESSION_CHANNEL':
        if (result.detail) parts.push(t('summary.channel', { detail: result.detail }))
        break
      default:
        break
    }
  }

  return parts.length > 0 ? parts.join(' ') : null
}
