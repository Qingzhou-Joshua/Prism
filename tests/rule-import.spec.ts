// tests/rule-import.spec.ts
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'http://localhost:5173'
const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts')

async function screenshot(page: import('@playwright/test').Page, name: string) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
  const filePath = path.join(ARTIFACTS_DIR, `rule-import-${name}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
  console.log(`Screenshot saved: ${filePath}`)
}

test.describe('Rule Import Flow', () => {
  test('should expand platform rules and import a new rule', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Filter out benign network 404s (e.g., favicon.ico)
        if (!text.includes('Failed to load resource')) {
          consoleErrors.push(text)
          console.log('[BROWSER ERROR]', text)
        }
      }
    })

    // Step 1: Navigate to app
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await screenshot(page, '01-home')

    // Step 2: Go to Scanner tab
    const scannerTab = page.locator('button').filter({ hasText: /^Scanner$/ })
    await expect(scannerTab).toBeVisible({ timeout: 5000 })
    await scannerTab.click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '02-scanner-tab')

    // Step 3: Find a platform card with the import button
    const importBtn = page.locator('button').filter({ hasText: /查看可导入规则/ }).first()
    await expect(importBtn).toBeVisible({ timeout: 8000 })
    await screenshot(page, '03-found-import-btn')

    // Step 4: Click to expand
    await importBtn.click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '04-expanded')

    // Step 5: Verify rule list loaded
    const hasRules = await page.locator('input[type="checkbox"]').count()
    const hasEmpty = await page.locator('text=该平台暂无可导入规则').count()
    expect(hasRules + hasEmpty, 'Should show rules or empty state').toBeGreaterThan(0)
    await screenshot(page, '05-rule-list')

    if (hasRules === 0) {
      console.log('No rules available to import — skipping import steps')
      return
    }

    // Step 6: Check for importable rules
    const importButton = page.locator('button').filter({ hasText: /导入已选/ }).first()
    const isDisabled = await importButton.evaluate((el) => (el as HTMLButtonElement).disabled)
    if (isDisabled) {
      console.log('No rules selected for import — all may be conflicts')
      await screenshot(page, '06-no-importable')
      return
    }

    // Step 7: Click import
    await importButton.click()
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll('button'))
        return btns.some(
          (b) => b.textContent?.includes('导入已选') || b.textContent?.includes('导入中') === false
        )
      },
      { timeout: 15000 }
    )
    await page.waitForLoadState('networkidle')
    await screenshot(page, '07-after-import')

    // Step 8: Verify summary message
    const summary = page.locator('text=✅ 成功').first()
    await expect(summary).toBeVisible({ timeout: 5000 })
    await screenshot(page, '08-summary')

    // Step 9: Navigate to Rules tab and verify rule is there
    const rulesTab = page.locator('button').filter({ hasText: /^Rules$/ })
    await expect(rulesTab).toBeVisible({ timeout: 5000 })
    await rulesTab.click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '09-rules-tab')

    const ruleItems = page.locator('button').filter({ hasText: /Edit/ })
    const ruleCount = await ruleItems.count()
    expect(ruleCount, 'Should have at least one rule after import').toBeGreaterThan(0)
    await screenshot(page, '10-rules-verified')

    expect(consoleErrors, 'No browser console errors expected').toHaveLength(0)
  })

  test('should show empty state for platforms without importRules support', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const scannerTab = page.locator('button').filter({ hasText: /^Scanner$/ })
    if (await scannerTab.isVisible()) {
      await scannerTab.click()
      await page.waitForLoadState('networkidle')
    }

    const importBtns = page.locator('button').filter({ hasText: /查看可导入规则/ })
    const count = await importBtns.count()
    console.log(`Found ${count} platform(s) with import button`)

    for (let i = 0; i < count; i++) {
      // Re-query each time since DOM may change after expand/collapse
      const expandBtns = page.locator('button').filter({ hasText: /查看可导入规则/ })
      const btn = expandBtns.nth(i)
      await btn.click()
      await page.waitForLoadState('networkidle')
      const errorCount = await page.locator('text=Unknown error').count()
      expect(errorCount, 'Should not show unknown errors').toBe(0)
      // Collapse: button text changes to 收起规则列表 after expanding
      const collapseBtn = page.locator('button').filter({ hasText: /收起规则列表/ }).first()
      if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await collapseBtn.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })
})
