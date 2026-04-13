import { test, expect, chromium } from '@playwright/test'
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
    const networkErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
        console.log('[BROWSER ERROR]', msg.text())
      }
    })

    page.on('requestfailed', (req) => {
      networkErrors.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
      console.log('[REQUEST FAILED]', req.method(), req.url(), req.failure()?.errorText)
    })

    // Track all DELETE requests to see their headers
    const deleteRequests: { url: string; headers: Record<string, string>; status?: number }[] = []

    page.on('request', (req) => {
      if (req.method() === 'DELETE') {
        console.log('[DELETE REQUEST]', req.url())
        console.log('[DELETE HEADERS]', JSON.stringify(req.headers(), null, 2))
        deleteRequests.push({ url: req.url(), headers: req.headers() })
      }
    })

    page.on('response', (res) => {
      if (res.request().method() === 'DELETE') {
        const entry = deleteRequests.find((r) => r.url === res.url())
        if (entry) entry.status = res.status()
        console.log('[DELETE RESPONSE]', res.url(), res.status())
      }
    })

    // Step 1: Navigate to app
    console.log('\n=== Step 1: Navigate to app ===')
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await screenshot(page, '01-home')

    // Step 2: Click Profiles tab
    console.log('\n=== Step 2: Click Profiles tab ===')
    const profilesTab = page.getByRole('button', { name: /profiles/i }).or(
      page.locator('[data-tab="profiles"]')
    ).or(
      page.locator('button').filter({ hasText: 'Profiles' })
    )
    await profilesTab.first().click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '02-profiles-tab')
    console.log('Profiles tab URL:', page.url())

    // Step 3: Click "New Profile"
    console.log('\n=== Step 3: Click New Profile ===')
    const newProfileBtn = page.getByRole('button', { name: /new profile/i })
    await expect(newProfileBtn).toBeVisible({ timeout: 5000 })
    await newProfileBtn.click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '03-new-profile-form')

    // Step 4: Fill in profile name and save
    console.log('\n=== Step 4: Fill profile name ===')
    const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill('Test E2E Profile')
    await screenshot(page, '04-filled-name')

    // Save the profile
    console.log('\n=== Step 5: Save profile ===')
    const saveBtn = page.getByRole('button', { name: /save/i })
    await expect(saveBtn).toBeVisible({ timeout: 5000 })
    await saveBtn.click()
    await page.waitForLoadState('networkidle')
    await screenshot(page, '05-after-save')

    // Step 6: Return to profiles list
    console.log('\n=== Step 6: Return to profiles list ===')
    // Try clicking "← Back" or "Profiles" tab again
    const backBtn = page.getByRole('button', { name: /back/i }).or(
      page.locator('button').filter({ hasText: /←|back/i })
    )
    if (await backBtn.count() > 0) {
      await backBtn.first().click()
    } else {
      // Click Profiles tab again
      await profilesTab.first().click()
    }
    await page.waitForLoadState('networkidle')
    await screenshot(page, '06-profiles-list')

    // Step 7: Find the created profile and delete it
    console.log('\n=== Step 7: Delete the test profile ===')
    const profileRow = page.locator('div').filter({ hasText: 'Test E2E Profile' }).first()
    await expect(profileRow).toBeVisible({ timeout: 5000 })
    await screenshot(page, '07-found-profile')

    // Handle browser confirm dialog
    page.on('dialog', async (dialog) => {
      console.log('[DIALOG]', dialog.type(), dialog.message())
      await dialog.accept()
    })

    const deleteBtn = profileRow.getByRole('button', { name: /delete/i })
      .or(page.locator('button').filter({ hasText: /delete/i }))

    // Find delete button near the profile
    const allDeleteBtns = page.locator('button').filter({ hasText: /^delete$|^Delete$/i })
    const deleteCount = await allDeleteBtns.count()
    console.log(`Found ${deleteCount} Delete button(s)`)

    if (deleteCount === 0) {
      await screenshot(page, '07b-no-delete-btn')
      throw new Error('No Delete button found on profiles page')
    }

    // Click the last delete button (most recently added profile)
    await allDeleteBtns.last().click()

    // Wait for network activity to settle
    await page.waitForLoadState('networkidle')
    await screenshot(page, '08-after-delete')

    // Verify the profile is gone
    console.log('\n=== Step 8: Verify profile was deleted ===')
    const profileStillExists = await page.locator('div').filter({ hasText: 'Test E2E Profile' }).count()
    console.log(`Profile rows still visible: ${profileStillExists}`)

    await screenshot(page, '09-final-state')

    // Report on DELETE requests
    console.log('\n=== DELETE Request Summary ===')
    for (const req of deleteRequests) {
      console.log('URL:', req.url)
      console.log('Status:', req.status)
      console.log('Content-Type header:', req.headers['content-type'] ?? '(none)')
    }

    console.log('\n=== Console Errors ===')
    for (const err of consoleErrors) {
      console.log(err)
    }

    expect(profileStillExists).toBe(0)
    expect(deleteRequests.length).toBeGreaterThan(0)

    // Verify no Content-Type header on DELETE request
    for (const req of deleteRequests) {
      const ct = req.headers['content-type']
      console.log(`\nContent-Type on DELETE: ${ct ?? '(none — CORRECT)'}`)
      expect(ct).toBeUndefined()
    }
  })
})
