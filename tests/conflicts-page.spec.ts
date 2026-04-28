import { test, expect } from '@playwright/test'
import { resetRegistry, scanRegistry, getConflicts } from './helpers/api.js'
import { selectPlatform, goToPage } from './helpers/navigate.js'

// ── Shared setup helper ───────────────────────────────────────────────────────

/** Navigate to Conflicts page under Claude Code. */
async function goToConflicts(page: Parameters<typeof goToPage>[0]) {
  await selectPlatform(page, 'Claude Code')
  await goToPage(page, 'Conflicts')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Conflicts Page', () => {
  // ── Test 1: Sidebar nav item exists and links to Conflicts page ────────────

  test('1. Conflicts nav item exists in sidebar and navigates to Conflicts page', async ({ page }) => {
    await selectPlatform(page, 'Claude Code')

    // The nav item should be visible in the sidebar
    const conflictsNav = page.locator('.sidebar-nav-item', { hasText: 'Conflicts' })
    await expect(conflictsNav).toBeVisible({ timeout: 8000 })

    // Click it
    await conflictsNav.click()

    // Page title should contain "Conflicts"
    await expect(page.locator('.page-title', { hasText: 'Conflicts' })).toBeVisible({ timeout: 8000 })

    // Subtitle should contain "Cross-platform"
    const subtitle = page.locator('.page-subtitle')
    await expect(subtitle).toBeVisible()
    await expect(subtitle).toContainText('Cross-platform')

    console.log('✓ Conflicts nav item exists and navigates to Conflicts page')
  })

  // ── Test 2: Empty state when registry is clean ─────────────────────────────

  test('2. Empty state shows "No conflicts detected" after registry reset', async ({ page }) => {
    // Clear registry via API — no conflicts can exist without indexed entries
    await resetRegistry()

    await goToConflicts(page)

    // Wait for loading to finish (loading-state div disappears)
    await expect(page.locator('.loading-state')).not.toBeVisible({ timeout: 10000 })

    // Empty state should appear
    const emptyState = page.locator('.empty-state')
    await expect(emptyState).toBeVisible({ timeout: 8000 })
    await expect(emptyState.locator('.empty-state-title')).toContainText('No conflicts detected')

    // No conflict cards should be present
    const cards = page.locator('.item-card-grid .item-card')
    expect(await cards.count()).toBe(0)

    console.log('✓ Empty state "No conflicts detected" shown after registry reset')
  })

  // ── Test 3: No badge in sidebar when no conflicts ─────────────────────────

  test('3. Sidebar Conflicts nav item shows no badge when conflict count is 0', async ({ page }) => {
    // Ensure registry is empty so conflict count is definitely 0
    await resetRegistry()

    await selectPlatform(page, 'Claude Code')

    // Wait for the sidebar to render
    const conflictsNav = page.locator('.sidebar-nav-item', { hasText: 'Conflicts' })
    await expect(conflictsNav).toBeVisible({ timeout: 8000 })

    // The badge span has inline style background: rgb(191, 48, 48) (#bf3030)
    // It is only rendered when conflictCount > 0, so it should NOT exist
    const badge = conflictsNav.locator('span[style*="#bf3030"], span[style*="rgb(191, 48, 48)"]')
    expect(await badge.count()).toBe(0)

    console.log('✓ Sidebar Conflicts nav item shows no red badge when registry is empty')
  })

  // ── Test 4: Refresh button is clickable and page does not crash ────────────

  test('4. Refresh button is present and clickable without crashing', async ({ page }) => {
    await goToConflicts(page)

    // Wait for page to finish loading
    await expect(page.locator('.page-title', { hasText: 'Conflicts' })).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.loading-state')).not.toBeVisible({ timeout: 10000 })

    // Refresh button: btn btn-ghost btn-sm with text "↻ Refresh"
    const refreshBtn = page.locator('button.btn-ghost', { hasText: '↻ Refresh' })
    await expect(refreshBtn).toBeVisible()
    await expect(refreshBtn).toBeEnabled()

    // Click — page should show loading momentarily then resolve without error
    await refreshBtn.click()

    // After click, page should still be intact (title still visible)
    await expect(page.locator('.page-title', { hasText: 'Conflicts' })).toBeVisible({ timeout: 8000 })

    // No JS error dialog or crash
    const errorOverlay = page.locator('[data-error], .error-boundary, .error-overlay')
    expect(await errorOverlay.count()).toBe(0)

    console.log('✓ Refresh button clicked without crashing the page')
  })

  // ── Test 5: Conflict card expand / collapse ────────────────────────────────

  test('5. Conflict card expands to show entry details and collapses on second click', async ({ page }) => {
    // Scan first to index real assets (may produce conflicts if same-named assets exist on ≥2 platforms)
    await scanRegistry()

    const data = await getConflicts()
    const conflicts = data.conflicts as Array<{
      key: string
      type: string
      name: string
      entries: Array<{ filePath: string; checksum: string; updatedAt: string; platformId: string }>
    }>

    if (conflicts.length === 0) {
      console.log('⚠ No real conflicts found after scan — skipping expand/collapse test')
      test.skip()
      return
    }

    await goToConflicts(page)

    // Wait for cards to appear
    await expect(page.locator('.loading-state')).not.toBeVisible({ timeout: 10000 })
    const grid = page.locator('.item-card-grid')
    await expect(grid).toBeVisible({ timeout: 8000 })

    const firstCard = grid.locator('.item-card').first()
    await expect(firstCard).toBeVisible()

    // Initially collapsed — chevron should be ▶
    const chevron = firstCard.locator('span', { hasText: '▶' })
    await expect(chevron).toBeVisible()

    // Click the card header row to expand
    const headerRow = firstCard.locator('div').first()
    await headerRow.click()

    // Chevron should now show ▼
    const chevronExpanded = firstCard.locator('span', { hasText: '▼' })
    await expect(chevronExpanded).toBeVisible({ timeout: 5000 })

    // Entry details should appear: filePath (monospace text) is visible
    // The expanded section contains entry.filePath and "checksum: <8chars>…"
    const checksumText = firstCard.locator('span', { hasText: 'checksum:' })
    await expect(checksumText.first()).toBeVisible({ timeout: 5000 })

    // filePath text is also visible (monospace div inside card)
    const expectedFilePath = conflicts[0].entries[0].filePath
    await expect(firstCard.locator(`text=${expectedFilePath}`)).toBeVisible()

    // Click again to collapse
    await headerRow.click()

    // Chevron goes back to ▶
    await expect(firstCard.locator('span', { hasText: '▶' })).toBeVisible({ timeout: 5000 })

    // Checksum text is gone
    await expect(checksumText.first()).not.toBeVisible({ timeout: 5000 })

    console.log(`✓ Conflict card expand/collapse works (tested on "${conflicts[0].name}")`)
  })

  // ── Test 6: Sidebar shows red badge when conflicts exist ──────────────────

  test('6. Sidebar Conflicts nav item shows red badge when conflicts exist', async ({ page }) => {
    await scanRegistry()

    const data = await getConflicts()
    const conflicts = data.conflicts as unknown[]

    if (conflicts.length === 0) {
      console.log('⚠ No real conflicts found after scan — skipping sidebar badge test')
      test.skip()
      return
    }

    // Navigate to the app (badge is loaded at App mount time)
    await selectPlatform(page, 'Claude Code')

    // Allow time for the App-level conflict count fetch to resolve
    await page.waitForResponse((resp) => resp.url().includes('/registry/conflicts'), { timeout: 8000 }).catch(() => {/* may already be loaded */})

    const conflictsNav = page.locator('.sidebar-nav-item', { hasText: 'Conflicts' })
    await expect(conflictsNav).toBeVisible({ timeout: 8000 })

    // Badge span has inline style background: #bf3030 (rendered as rgb by browser)
    // Playwright matches style attribute substrings, so we check for the partial value
    const badge = conflictsNav.locator('span').filter({
      has: page.locator('xpath=self::span[contains(@style,"bf3030") or contains(@style,"191, 48, 48")]'),
    })

    // Fallback: if XPath filter doesn't match (browser normalises to rgb), check any span with number text
    const badgeCount = await badge.count()
    if (badgeCount > 0) {
      await expect(badge.first()).toBeVisible()
      const badgeText = await badge.first().textContent()
      expect(Number(badgeText)).toBeGreaterThan(0)
      console.log(`✓ Sidebar red badge shows count ${badgeText} when ${conflicts.length} conflict(s) exist`)
    } else {
      // Fallback approach: locate any span inside the nav item whose text is a positive number
      const allSpans = conflictsNav.locator('span')
      let foundBadge = false
      const spanCount = await allSpans.count()
      for (let i = 0; i < spanCount; i++) {
        const text = (await allSpans.nth(i).textContent())?.trim() ?? ''
        if (/^\d+$/.test(text) && Number(text) > 0) {
          foundBadge = true
          console.log(`✓ Sidebar badge found via fallback: "${text}" conflict(s)`)
          break
        }
      }
      expect(foundBadge).toBe(true)
    }
  })
})
