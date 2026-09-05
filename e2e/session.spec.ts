import { expect, test } from '@playwright/test'

function silentWav(seconds = 0.3, rate = 22050): Buffer {
  const data = Buffer.alloc(Math.floor(seconds * rate) * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

test('a child can complete a session and level up', async ({ page }) => {
  await page.route('**/samples/**', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() }),
  )
  await page.goto('/')
  await page.getByLabel('Name').fill('Ada')
  await page.getByRole('button', { name: "Let's go!" }).click()
  await page.getByRole('button', { name: /play/i }).click()
  await expect(page.getByTestId('screen-session')).toBeVisible({ timeout: 20_000 })

  let leveledUp = false
  const deadline = Date.now() + 100_000
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const st = window.__earTrainer.getState()
      return {
        screen: st.screen,
        phase: st.session?.phase,
        current: st.session?.currentChordId ?? null,
      }
    })
    if (s.screen === 'summary') break
    if (s.phase === 'levelUp') {
      leveledUp = true
      await page.getByRole('button', { name: 'Continue' }).click()
      // Continue runs the get-ready ritual into a fresh session; a perfect player
      // would level up forever, so answer a few more and stop to reach the summary.
      for (let i = 0; i < 3; i++) {
        await page.waitForFunction(
          () => window.__earTrainer.getState().session?.phase === 'question',
          null,
          { timeout: 10_000 },
        )
        const cur = await page.evaluate(
          () => window.__earTrainer.getState().session?.currentChordId,
        )
        await page.getByTestId(`tile-${cur}`).click()
        await page.waitForFunction(
          () => window.__earTrainer.getState().session?.phase !== 'feedback',
          null,
          { timeout: 10_000 },
        )
      }
      await page.getByRole('button', { name: 'Stop' }).click()
      continue
    }
    if (s.phase !== 'question' || !s.current) {
      await page.waitForTimeout(200)
      continue
    }
    await page.getByTestId(`tile-${s.current}`).click()
    // Feedback ends when the store leaves the feedback phase; poll that rather than a fixed delay.
    await page.waitForFunction(
      () => window.__earTrainer.getState().session?.phase !== 'feedback',
      null,
      { timeout: 10_000 },
    )
  }

  await expect(page.getByTestId('screen-summary')).toBeVisible()
  await expect(page.getByTestId('stars')).toHaveText('⭐⭐⭐')
  expect(leveledUp).toBe(true)
})
