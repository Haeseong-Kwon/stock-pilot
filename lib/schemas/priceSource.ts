/**
 * Stands alone so `expression.ts` and `indicatorParams.ts` can both use it
 * without importing each other — that cycle left `PRICE_SOURCES` undefined at
 * module-init time under webpack.
 */
export const PRICE_SOURCES = ['OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOLUME'] as const
export type PriceSource = (typeof PRICE_SOURCES)[number]
