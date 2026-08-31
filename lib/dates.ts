const UNIT_SECONDS: Record<string, number> = {
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  M: 2629800,
  y: 31557600,
}

/**
 * Resolves a date reference to a UTC epoch in seconds.
 * Accepts `now`, ISO dates (`2024-01-01`), and offsets (`-1y`, `6M`, `-30d`).
 * Returns null when the reference cannot be understood.
 */
export function resolveDateRef(ref: string, now = Date.now()): number | null {
  const value = ref.trim()
  if (!value) return null
  if (value.toLowerCase() === 'now' || value.toLowerCase() === 'today') {
    return Math.floor(now / 1000)
  }
  const offset = /^([+-]?)(\d+(?:\.\d+)?)\s*(m|h|d|w|M|y)$/.exec(value)
  if (offset) {
    const [, sign, amount, unit] = offset
    const seconds = UNIT_SECONDS[unit as string]
    if (seconds === undefined || amount === undefined) return null
    // A bare offset means "ago" — the only direction that makes sense on a chart.
    const direction = sign === '+' ? 1 : -1
    return Math.floor(now / 1000) + direction * Number(amount) * seconds
  }
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(parsed)) return null
  return Math.floor(parsed / 1000)
}

export function resolveRange(
  range: { from?: string; to?: string } | undefined,
  now = Date.now(),
): { from?: number; to?: number } | undefined {
  if (!range) return undefined
  const from = range.from ? resolveDateRef(range.from, now) : null
  const to = range.to ? resolveDateRef(range.to, now) : null
  if (from === null && to === null) return undefined
  return { ...(from !== null ? { from } : {}), ...(to !== null ? { to } : {}) }
}
