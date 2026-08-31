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
const context = await browser.newContext({ viewport: { width: 1512, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const canvases = () => page.locator('canvas').count()
const send = async (prompt) => {
  await page.fill('textarea', prompt)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1800)
}
const setLanguage = async (name) => {
  await page.getByLabel(/설정 및 정보|Settings and about/).click()
  await page.getByRole('radio', { name }).click()
  await page.getByLabel(/설정 및 정보|Settings and about/).click() // close the popover
  await page.waitForTimeout(400)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

check('chart canvas rendered', (await canvases()) > 0, `${await canvases()} canvases`)
check('legend shows OHLC', await page.locator('text=/O\\s[\\d,.]+/').first().isVisible())

// --- default language is Korean ---
check('UI defaults to Korean', await page.getByText('AI 애널리스트').isVisible())
check('Korean prompt chips shown', (await page.getByRole('button', { name: /표시해|찾아줘/ }).count()) > 0)

// --- the command gallery runs everything the demo supports, by click ---
await page.getByLabel('명령 갤러리').first().click()
await page.waitForSelector('[role="dialog"]')
const galleryRows = await page.locator('[role="dialog"] li button').count()
check('gallery lists every demo command', galleryRows >= 25, `${galleryRows} rows`)
await page.fill('[role="dialog"] input', '볼린저')
await page.waitForTimeout(200)
const filtered = await page.locator('[role="dialog"] li button').count()
check('gallery search filters', filtered > 0 && filtered < galleryRows, `${galleryRows} -> ${filtered}`)
// Read the declared command type off the row itself rather than hard-coding it.
const firstRow = page.locator('[role="dialog"] li button').first()
const declared = await firstRow.evaluate((el) => {
  const badge = [...el.querySelectorAll('span')].find((s) => /^[A-Z_]+$/.test(s.textContent?.trim() ?? ''))
  return badge?.textContent?.trim() ?? '?'
})
const cardsBefore = await page.getByText(declared, { exact: true }).count()
await firstRow.click()
await page.waitForTimeout(1800)
check('gallery closes after a pick', (await page.locator('[role="dialog"]').count()) === 0)
const cardsAfter = await page.getByText(declared, { exact: true }).count()
check(
  'gallery click runs the declared command',
  cardsAfter > cardsBefore - galleryRows,
  `${declared}: ${cardsAfter} result card(s)`,
)
await send('전부 지워')

const baseline = await canvases()
await send('add RSI')
check('RSI pane added', (await canvases()) > baseline, `${baseline} -> ${await canvases()}`)
check('RSI badge visible', (await page.locator('[aria-label="RSI 14 제거"]').count()) === 1)

await send('mark days that dropped more than 5% in the last year')
const matched = await page.locator('text=/\\d+건 일치/').first().textContent()
check('signal reported matches in Korean', /[1-9]/.test(matched ?? ''), matched ?? 'none')

await send('그중 거래량이 두 배 이상 터진 것만 남겨')
const narrowed = await page.locator('text=/\\d+건 일치/').last().textContent()
check('signal narrowed in place', (await page.locator('[aria-label^="Drop"]').count()) === 1, narrowed ?? '')

await send('최근 6개월 지지선과 저항선 찾아줘')
check('support/resistance found', (await page.getByText('지지 · 저항').count()) > 0)

if (SHOT) await page.screenshot({ path: `${SHOT}/chartpilot-ko.png` })

// --- switching to English relabels the whole UI, chart state untouched ---
await setLanguage('English')
check('switched to English', await page.getByText('AI Analyst').isVisible())
check('command results relabelled', (await page.getByText('Support / resistance').count()) > 0)
check('counts pluralised in English', (await page.locator('text=/\\d+ match/').count()) > 0)
check('chart survives the language switch', (await canvases()) > baseline)
check('badges relabelled', (await page.locator('[aria-label="Remove RSI 14"]').count()) === 1)

if (SHOT) await page.screenshot({ path: `${SHOT}/chartpilot-en.png` })

// --- the choice persists across a reload ---
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
check('language persists after reload', await page.getByText('AI Analyst').isVisible())

// --- back to Korean, and clearing keeps the candles ---
await setLanguage('한국어')
await send('전부 지워')
check('annotations cleared', (await page.locator('[aria-label^="Drop"]').count()) === 0)
check('candles survive the clear', (await canvases()) > 0)

check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
