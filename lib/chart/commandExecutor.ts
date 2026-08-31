import type { Candle } from '@/lib/types'
import type { ChartCommand, ChartCommandType } from '@/lib/schemas/chartCommand'
import type { MessageKey } from '@/lib/i18n/messages'
import { evaluateSignal, findSupportResistance } from '@/lib/analysis/signals'
import { resolveDateRef, resolveRange } from '@/lib/dates'
import { useChartStore, type ChartState } from '@/stores/chartStore'
import { describeCondition } from './describe'
import { indicatorLabel } from './indicators'

export type CommandResult = {
  type: ChartCommandType
  /** Translation key for a fixed label. */
  labelKey?: MessageKey
  /** Literal label, used where the text is user or AI supplied (signal names). */
  label?: string
  detail?: string
  count?: number
  status: 'ok' | 'empty' | 'error'
  messageKey?: MessageKey
}

export type StoreApi = { getState: () => ChartState }

function fail(type: ChartCommandType, messageKey: MessageKey): CommandResult {
  return { type, labelKey: 'cmd.failed', status: 'error', messageKey }
}

export function executeCommand(
  command: ChartCommand,
  candles: Candle[],
  api: StoreApi = useChartStore,
): CommandResult {
  const store = api.getState()

  switch (command.type) {
    case 'SET_SYMBOL':
      store.setSymbol(command.symbol)
      return {
        type: command.type,
        labelKey: 'cmd.symbol',
        detail: command.symbol.toUpperCase(),
        status: 'ok',
      }

    case 'SET_TIMEFRAME':
      store.setTimeframe(command.timeframe)
      return { type: command.type, labelKey: 'cmd.timeframe', detail: command.timeframe, status: 'ok' }

    case 'ADD_INDICATOR': {
      const def = store.addIndicator(command.indicator, command.params)
      return {
        type: command.type,
        labelKey: 'cmd.indicatorAdded',
        detail: indicatorLabel(def),
        status: 'ok',
      }
    }

    case 'REMOVE_INDICATOR': {
      const removed = store.removeIndicator(command.indicator, command.params)
      return {
        type: command.type,
        labelKey: removed > 0 ? 'cmd.indicatorRemoved' : 'cmd.nothingToRemove',
        detail: command.indicator,
        count: removed,
        status: removed > 0 ? 'ok' : 'empty',
      }
    }

    case 'UPDATE_INDICATOR': {
      const def = store.updateIndicator(command.indicator, command.params)
      if (!def) {
        return {
          type: command.type,
          labelKey: 'cmd.notOnChart',
          detail: command.indicator,
          status: 'empty',
        }
      }
      return {
        type: command.type,
        labelKey: 'cmd.indicatorUpdated',
        detail: indicatorLabel(def),
        status: 'ok',
      }
    }

    case 'CREATE_SIGNAL':
    case 'UPDATE_SIGNAL': {
      const isUpdate = command.type === 'UPDATE_SIGNAL'
      const range = resolveRange(command.range)
      let signal
      if (isUpdate) {
        signal = store.updateSignal(command.name, {
          ...(command.condition ? { condition: command.condition } : {}),
          ...(range ? { range } : {}),
          ...(command.visualization?.color ? { color: command.visualization.color } : {}),
          ...(command.visualization?.position ? { position: command.visualization.position } : {}),
        })
        if (!signal) return fail(command.type, 'msg.noSignal')
      } else {
        signal = store.upsertSignal({
          name: command.name,
          condition: command.condition,
          ...(range ? { range } : {}),
          ...(command.visualization?.color ? { color: command.visualization.color } : {}),
          position: command.visualization?.position ?? 'aboveBar',
          shape: command.visualization?.shape ?? 'circle',
        })
      }
      const matches = evaluateSignal(candles, signal.condition, signal.range)
      return {
        type: command.type,
        label: signal.name,
        detail: describeCondition(signal.condition),
        count: matches.length,
        status: matches.length > 0 ? 'ok' : 'empty',
        ...(matches.length === 0 ? { messageKey: 'msg.noMatches' as const } : {}),
      }
    }

    case 'REMOVE_SIGNAL': {
      const removed = store.removeSignal(command.name)
      return {
        type: command.type,
        labelKey: removed > 0 ? 'cmd.signalRemoved' : 'cmd.nothingToRemove',
        ...(command.name ? { detail: command.name } : {}),
        count: removed,
        status: removed > 0 ? 'ok' : 'empty',
      }
    }

    case 'HIGHLIGHT_RANGE': {
      const from = resolveDateRef(command.from)
      const to = resolveDateRef(command.to)
      if (from === null || to === null) return fail(command.type, 'msg.badRange')
      store.addHighlight({
        from: Math.min(from, to),
        to: Math.max(from, to),
        label: command.label ?? 'Highlight',
        color: command.color ?? '#4a9eff',
      })
      return {
        type: command.type,
        labelKey: 'cmd.rangeHighlighted',
        detail: `${command.from} → ${command.to}`,
        status: 'ok',
      }
    }

    case 'ADD_PRICE_LINE':
      store.addPriceLine({
        price: command.price,
        label: command.label ?? String(command.price),
        color: command.color ?? '#94a3b8',
      })
      return {
        type: command.type,
        labelKey: 'cmd.priceLine',
        detail: String(command.price),
        status: 'ok',
      }

    case 'ZOOM_RANGE': {
      const from = resolveDateRef(command.from)
      const to = command.to ? resolveDateRef(command.to) : null
      if (from === null) return fail(command.type, 'msg.badRange')
      store.requestZoom(from, to ?? undefined)
      return {
        type: command.type,
        labelKey: 'cmd.zoomed',
        detail: `${command.from} → ${command.to ?? 'now'}`,
        status: 'ok',
      }
    }

    case 'CLEAR_ANNOTATIONS': {
      const scope = command.scope ?? 'all'
      store.clear(scope)
      return { type: command.type, labelKey: 'cmd.cleared', detail: scope, status: 'ok' }
    }

    case 'FIND_SUPPORT_RESISTANCE': {
      const range = resolveRange(command.range)
      const scoped = candles.filter(
        (c) =>
          (range?.from === undefined || c.time >= range.from) &&
          (range?.to === undefined || c.time <= range.to),
      )
      const levels = findSupportResistance(scoped.length > 20 ? scoped : candles, {
        ...(command.maxLevels !== undefined ? { maxLevels: command.maxLevels } : {}),
      })
      store.setLevels(levels)
      return {
        type: command.type,
        labelKey: 'cmd.levels',
        detail: levels.map((l) => l.price.toFixed(2)).join(', '),
        count: levels.length,
        status: levels.length > 0 ? 'ok' : 'empty',
        ...(levels.length === 0 ? { messageKey: 'msg.noLevels' as const } : {}),
      }
    }
  }
}

export function executeCommands(
  commands: ChartCommand[],
  candles: Candle[],
  api: StoreApi = useChartStore,
): CommandResult[] {
  return commands.map((command) => {
    try {
      return executeCommand(command, candles, api)
    } catch (error) {
      console.error('[command] execution failed:', error)
      return fail(command.type, 'msg.unexpected')
    }
  })
}
