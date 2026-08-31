/**
 * Browser smoke test. Requires a running server:
 *   npm run dev            # in another shell
 *   npm run test:e2e
 * Set BASE_URL to point somewhere else.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const SHOT = process.env.SHOT_DIR ?? null

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1512, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const countCanvases = () => page.locator('canvas').count()
const send = async (prompt) => {
  await page.fill('textarea', prompt)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1800)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

check('chart canvas rendered', (await countCanvases()) > 0, `${await countCanvases()} canvases`)
check('legend shows OHLC', await page.locator('text=/O\\s[\\d,.]+/').first().isVisible())

const baseline = await countCanvases()
await send('add RSI')
check('RSI pane added', (await countCanvases()) > baseline, `${baseline} -> ${await countCanvases()}`)
check('RSI badge visible', (await page.locator('[aria-label="Remove RSI 14"]').count()) === 1)

await send('mark days that dropped more than 5% in the last year')
const matches = await page.locator('text=/\\d+ match/').first().textContent()
check('signal reported matches', /[1-9]/.test(matches ?? ''), matches ?? 'none')

await send('그중 거래량이 두 배 이상 터진 것만 남겨')
const narrowed = await page.locator('text=/\\d+ match/').last().textContent()
check('signal narrowed in place', (await page.locator('[aria-label^="Remove Drop"]').count()) === 1, narrowed ?? '')

await send('최근 6개월 지지선과 저항선 찾아줘')
check('support/resistance found', (await page.locator('text=Support / resistance').count()) > 0)

if (SHOT) await page.screenshot({ path: `${SHOT}/chartpilot.png`, fullPage: false })

await send('전부 지워')
check('annotations cleared', (await page.locator('[aria-label^="Remove Drop"]').count()) === 0)
check('candles survive the clear', (await countCanvases()) > 0)

check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
