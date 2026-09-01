import { z } from 'zod'
import { TIMEFRAMES } from '@/lib/types'
import { INDICATOR_TYPES } from '@/lib/analysis/indicators/registry'
import { ConditionSchema } from '@/lib/schemas/expression'
import { IndicatorParamsSchema } from '@/lib/schemas/indicatorParams'
import { CHART_TYPES, PRICE_SCALE_MODES } from './chartTypes'

/**
 * What survives a reload. Validated on read: a stale or hand-edited entry must
 * never be able to put the chart into a state the app cannot render.
 */
export const WorkspaceSchema = z.object({
  version: z.literal(1),
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(TIMEFRAMES),
  chartType: z.enum(CHART_TYPES),
  priceScaleMode: z.enum(PRICE_SCALE_MODES),
  indicators: z
    .array(z.object({ type: z.enum(INDICATOR_TYPES), params: IndicatorParamsSchema }))
    .max(30),
  signals: z
    .array(
      z.object({
        name: z.string().max(60),
        condition: ConditionSchema,
        range: z.object({ from: z.number().optional(), to: z.number().optional() }).optional(),
        color: z.string().max(32),
        position: z.enum(['aboveBar', 'belowBar']),
        shape: z.enum(['circle', 'square', 'arrowUp', 'arrowDown']),
      }),
    )
    .max(20),
  recentSymbols: z.array(z.string().max(20)).max(12),
})

export type Workspace = z.infer<typeof WorkspaceSchema>

const KEY = 'chartpilot.workspace'

export function loadWorkspace(): Workspace | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = WorkspaceSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      // A schema change or corrupt entry: drop it rather than half-restore.
      window.localStorage.removeItem(KEY)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

export function saveWorkspace(workspace: Workspace): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(workspace))
  } catch {
    // Private mode or a full quota: the session simply does not persist.
  }
}

export function clearWorkspace(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing to do — the next save will fail the same way.
  }
}
