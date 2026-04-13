import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'http://localhost:5173'
const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts')

async function screenshot(page: import('@playwright/test').Page, name: string) {
  const filePath = path.join(ARTIFACTS_DIR, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
  console.log(`Screenshot saved: ${filePath}`)
}

test.describe('Profile Delete Flow', () => {
  test('should create and delete a profile successfully', async ({ page }) => {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })

    // Collect console errors and network failures
    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
        console.log('[BROWSER ERROR]', msg.text())
      }
    })

    page.on('requestfailed', (req) => {
      console.log('[REQUEST FAILED]', req.method(), req.url(), req.failure()?.errorText)
    })

    // Track all DELETE requests to see their headers and status
    const deleteRequests: { url: string; headers: Record<string, string>; status?: number }[] = []

    page.on('request', (req) => {
      if (req.method() === 'DELETE') {
        const headers = req.headers()
        console.log('[DELETE REQUEST]', req.url())
        console.log('[DELETE HEADERS]', JSON.stringify(headers, null, 2))
        deleteRequests.push({ url: req.url(), headers })
      }
    })

    page.on('response', (res) => {
      if (res.request().method() === 'DELETE') {
        const entry = deleteRequests.find((r) => r.url === res.url())
        if (entry) entry.status = res.status()
        console.log('[DELETE RESPONSE]', res.url(), 'STATUS:', res.status())
      }
    })

    // ─── Step 1: Navigate to app ───────────────────────────────────────────
    console.log('\n=== Step 1: Navigate to app ===')
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await screenshot(page, '01-home')
    console.log('Page title:', await page.title())

    // ─── Step 2: Click Profiles tab ────────────────────────────────────────
    console.log('\n=== Step 2: Click Profiles tab ===')
    const profilesTab = page.locator('button').filter({ hasText: /^Profiles$/ })
    await expect(profilesTab).toBeVisible({ timeout: 5000 })
    await profilesTab.click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '02-profiles-tab')

    // ─── Step 3: Click "New Profile" ───────────────────────────────────────
    console.log('\n=== Step 3: Click New Profile ===')
    const newProfileBtn = page.locator('button').filter({ hasText: /\+ New Profile/ })
    await expect(newProfileBtn).toBeVisible({ timeout: 5000 })
    await newProfileBtn.click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '03-new-profile-form')

    // ─── Step 4: Fill in profile name ──────────────────────────────────────
    // The Name input has placeholder="My Profile" (no explicit type attribute)
    console.log('\n=== Step 4: Fill profile name ===')
    const nameInput = page.locator('input[placeholder="My Profile"]')
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill('Test E2E Profile')
    await screenshot(page, '04-filled-name')

    // ─── Step 5: Save the profile ──────────────────────────────────────────
    console.log('\n=== Step 5: Save profile ===')
    const saveBtn = page.locator('button').filter({ hasText: /^Save$/ })
    await expect(saveBtn).toBeVisible({ timeout: 5000 })
    await saveBtn.click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '05-after-save')

    // ─── Step 6: Return to profiles list ───────────────────────────────────
    // After save, onSave() is called → ProfilesPage is shown again
    console.log('\n=== Step 6: Verify profiles list ===')
    // The profiles list should now be visible again
    const newProfileBtnAgain = page.locator('button').filter({ hasText: /\+ New Profile/ })
    await expect(newProfileBtnAgain).toBeVisible({ timeout: 5000 })
    await screenshot(page, '06-profiles-list')

    // ─── Step 7: Find and delete the profile ───────────────────────────────
    console.log('\n=== Step 7: Find the test profile ===')

    // The profile cards are direct children of the flex column container.
    // Each card contains the name as the first bold text, plus Edit/Delete buttons.
    // Use a strict locator: a card div that directly contains "Test E2E Profile" as text.
    // We look for the card div that has BOTH the profile name AND a Delete button inside.
    const testProfileCard = page.locator('div').filter({
      has: page.locator('div').filter({ hasText: /^Test E2E Profile$/ }),
    }).filter({
      has: page.locator('button', { hasText: /^Delete$/ }),
    }).first()

    await expect(testProfileCard).toBeVisible({ timeout: 5000 })
    await screenshot(page, '07-found-profile')

    // Accept the browser confirm dialog automatically
    page.on('dialog', async (dialog) => {
      console.log('[DIALOG]', dialog.type(), ':', dialog.message())
      await dialog.accept()
    })

    // Click the Delete button inside our specific profile card
    const deleteBtn = testProfileCard.locator('button', { hasText: /^Delete$/ })
    await expect(deleteBtn).toBeVisible({ timeout: 3000 })
    console.log('Clicking Delete button for "Test E2E Profile"')
    await deleteBtn.click()

    // Wait for network and UI to settle
    await page.waitForLoadState('networkidle')
    await screenshot(page, '08-after-delete')

    // ─── Step 8: Verify profile was removed ────────────────────────────────
    console.log('\n=== Step 8: Verify deletion ===')
    // Check specifically for the profile card (has both name AND buttons), not any div containing the text
    const profileCardAfter = page.locator('div').filter({
      has: page.locator('div').filter({ hasText: /^Test E2E Profile$/ }),
    }).filter({
      has: page.locator('button', { hasText: /^Delete$/ }),
    })
    const profileStillExists = await profileCardAfter.count()
    console.log(`Profile cards still visible: ${profileStillExists}`)

    await screenshot(page, '09-final-state')

    // ─── Summary ───────────────────────────────────────────────────────────
    console.log('\n=== DELETE Request Summary ===')
    if (deleteRequests.length === 0) {
      console.log('WARNING: No DELETE requests were captured!')
    }
    for (const req of deleteRequests) {
      console.log('URL:', req.url)
      console.log('HTTP Status:', req.status)
      const ct = req.headers['content-type']
      console.log('Content-Type header:', ct ?? '(none — CORRECT)')
      if (ct) {
        console.log('BUG: Content-Type header is PRESENT on DELETE — this causes FST_ERR_CTP_EMPTY_JSON_BODY!')
      }
    }

    console.log('\n=== Console Errors ===')
    if (consoleErrors.length === 0) {
      console.log('No console errors.')
    }
    for (const err of consoleErrors) {
      console.log(err)
    }

    // ─── Assertions ────────────────────────────────────────────────────────
    expect(deleteRequests.length, 'Expected at least 1 DELETE request').toBeGreaterThan(0)
    expect(profileStillExists, 'Profile should be removed from the list after deletion').toBe(0)

    // Verify NO Content-Type header on DELETE requests (the core bug fix)
    for (const req of deleteRequests) {
      const ct = req.headers['content-type']
      expect(ct, `DELETE request to ${req.url} should NOT have Content-Type header`).toBeUndefined()
    }

    // Verify DELETE returned 204
    for (const req of deleteRequests) {
      expect(req.status, `DELETE request should return 204, got ${req.status}`).toBe(204)
    }
  })
})
