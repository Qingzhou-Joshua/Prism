import { test, expect, type Page } from '@playwright/test'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait for the platform tabs to load and click Claude Code */
async function selectClaudeCode(page: Page) {
  await page.goto('/')
  // Wait for platform tabs to appear (not the loading spinner)
  await expect(page.locator('.platform-tab').first()).toBeVisible({ timeout: 10000 })
  // Click Claude Code tab
  const claudeTab = page.locator('.platform-tab', { hasText: 'Claude Code' })
  await expect(claudeTab).toBeVisible()
  await claudeTab.click()
}

/** Navigate to Hooks via sidebar */
async function goToHooks(page: Page) {
  const hooksNav = page.locator('.sidebar-nav-item', { hasText: 'Hooks' })
  await expect(hooksNav).toBeVisible()
  await hooksNav.click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Hooks Management', () => {
  test('1. Hooks page loads and shows hooks grouped by event type', async ({ page }) => {
    await selectClaudeCode(page)
    await goToHooks(page)

    // Page title should appear
    await expect(page.locator('.page-title', { hasText: 'Hooks' })).toBeVisible()

    // Subtitle shows hook count (we know there are hooks in claude-code)
    const subtitle = page.locator('.page-subtitle')
    await expect(subtitle).toBeVisible()
    await expect(subtitle).toContainText('hook')

    // At least one event group should be visible (PreToolUse, PostToolUse, etc.)
    const eventGroups = page.locator('.hooks-event-group')
    await expect(eventGroups.first()).toBeVisible({ timeout: 8000 })
    const groupCount = await eventGroups.count()
    expect(groupCount).toBeGreaterThan(0)

    // Event group headers visible with chevron
    const firstHeader = page.locator('.hooks-event-header').first()
    await expect(firstHeader).toBeVisible()
    await expect(firstHeader).toContainText('PreToolUse')

    // Hook cards inside expanded group
    const hookCards = page.locator('.item-card')
    await expect(hookCards.first()).toBeVisible()
    const cardCount = await hookCards.count()
    expect(cardCount).toBeGreaterThan(0)

    console.log(`✓ Hooks page loaded: ${groupCount} event groups, ${cardCount} hook cards visible`)
  })

  test('2. Collapsible event group sections work', async ({ page }) => {
    await selectClaudeCode(page)
    await goToHooks(page)

    // Wait for groups to load
    await expect(page.locator('.hooks-event-group').first()).toBeVisible({ timeout: 8000 })

    // Scope everything to the first event group
    const firstGroup = page.locator('.hooks-event-group').first()
    const firstHeader = firstGroup.locator('.hooks-event-header')
    const firstItems = firstGroup.locator('.hooks-event-items')

    // Initially expanded — items should be visible
    await expect(firstItems).toBeVisible()
    const chevronBefore = await firstHeader.locator('.hooks-event-chevron').textContent()
    expect(chevronBefore).toBe('▼')

    // Click to collapse — items container is removed from DOM
    await firstHeader.click()
    await expect(firstItems).not.toBeAttached({ timeout: 5000 })
    const chevronCollapsed = await firstHeader.locator('.hooks-event-chevron').textContent()
    expect(chevronCollapsed).toBe('▶')

    // Click to expand again
    await firstHeader.click()
    await expect(firstItems).toBeVisible({ timeout: 5000 })
    const chevronExpanded = await firstHeader.locator('.hooks-event-chevron').textContent()
    expect(chevronExpanded).toBe('▼')

    console.log('✓ Collapse/expand works correctly')
  })

  test('3. New Hook button opens HookEditorPage form', async ({ page }) => {
    await selectClaudeCode(page)
    await goToHooks(page)

    // Wait for page to load
    await expect(page.locator('.page-title', { hasText: 'Hooks' })).toBeVisible()

    // Click New Hook button
    await page.locator('.btn-primary', { hasText: 'New Hook' }).click()

    // Editor should open
    await expect(page.locator('.rule-editor-page')).toBeVisible()
    await expect(page.locator('h2', { hasText: 'New Hook' })).toBeVisible()

    // Form fields should be present
    await expect(page.locator('label', { hasText: 'Event Type *' })).toBeVisible()
    await expect(page.locator('label', { hasText: 'Matcher *' })).toBeVisible()
    await expect(page.locator('label', { hasText: 'Description (optional)' })).toBeVisible()
    // "Actions *" is a <span class="form-label">, not a <label>
    await expect(page.locator('.form-label', { hasText: 'Actions *' })).toBeVisible()

    // Default event type should be PostToolUse
    const eventTypeSelect = page.locator('select').first()
    await expect(eventTypeSelect).toHaveValue('PostToolUse')

    // Save button should be disabled (matcher empty)
    const saveBtn = page.locator('button.btn-primary', { hasText: 'Save' })
    await expect(saveBtn).toBeDisabled()

    // Cancel button should be enabled
    await expect(page.locator('button', { hasText: 'Cancel' })).toBeEnabled()

    console.log('✓ New Hook editor opens with correct form structure')
  })

  test('4. Create a new hook end-to-end', async ({ page }) => {
    await selectClaudeCode(page)
    await goToHooks(page)
    await expect(page.locator('.page-title', { hasText: 'Hooks' })).toBeVisible()

    const hooksBefore = await page.locator('.item-card').count()

    // Open new hook editor
    await page.locator('.btn-primary', { hasText: 'New Hook' }).click()
    await expect(page.locator('h2', { hasText: 'New Hook' })).toBeVisible()

    // Set Event Type to PostToolUse (already default)
    const eventTypeSelect = page.locator('select').first()
    await eventTypeSelect.selectOption('PostToolUse')

    // Fill in Matcher
    const matcherInput = page.locator('input[placeholder*="Write|Edit"]')
    await matcherInput.fill('Write|Edit')

    // Fill in Description
    const descInput = page.locator('input[placeholder="Brief description of this hook"]')
    await descInput.fill('E2E test hook — auto-format on save')

    // Fill in command action
    const commandInput = page.locator('input[placeholder="e.g. pnpm format"]')
    await commandInput.fill('echo test-hook-e2e')

    // Save button should now be enabled
    const saveBtn = page.locator('button.btn-primary', { hasText: 'Save' })
    await expect(saveBtn).toBeEnabled()

    // Save
    await saveBtn.click()

    // Should return to hooks list
    await expect(page.locator('.page-title', { hasText: 'Hooks' })).toBeVisible({ timeout: 8000 })

    // New hook should appear in the list
    // Find the Write|Edit matcher in a PostToolUse group (use exact event type match)
    const newHookCard = page.locator('.item-card .hooks-matcher', { hasText: 'Write|Edit' }).last()
    await expect(newHookCard).toBeVisible()

    console.log('✓ New hook created and appears in list')
  })

  test('5. Edit an existing hook', async ({ page }) => {
    await selectClaudeCode(page)
    await goToHooks(page)

    // Wait for hooks to load
    await expect(page.locator('.hooks-event-group').first()).toBeVisible({ timeout: 8000 })

    // Find and click the hook we created in test 4 (Write|Edit in PostToolUse)
    // Or fall back to the first available hook
    const postToolUseGroup = page.locator('.hooks-event-group', { hasText: 'PostToolUse' })
    let targetCard: ReturnType<Page['locator']>

    const e2eCard = page.locator('.item-card', { has: page.locator('.hooks-matcher', { hasText: 'Write|Edit' }) }).last()
    if (await e2eCard.count() > 0) {
      targetCard = e2eCard
    } else {
      // Fallback: click first visible hook card
      targetCard = page.locator('.hooks-event-items .item-card').first()
    }

    await expect(targetCard).toBeVisible()
    await targetCard.click()

    // Editor should open in edit mode
    await expect(page.locator('.rule-editor-page')).toBeVisible()
    await expect(page.locator('h2')).toContainText('Edit Hook')

    // Modify description
    const descInput = page.locator('input[placeholder="Brief description of this hook"]')
    const currentDesc = await descInput.inputValue()
    await descInput.fill(currentDesc + ' [updated]')

    // Save
    const saveBtn = page.locator('button.btn-primary', { hasText: 'Save' })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Return to hooks list
    await expect(page.locator('.page-title', { hasText: 'Hooks' })).toBeVisible({ timeout: 8000 })

    console.log('✓ Edit hook: updated description and saved successfully')
  })

  test('6. Delete the E2E test hook', async ({ page }) => {
    await selectClaudeCode(page)
    await goToHooks(page)

    // Wait for hooks to load
    await expect(page.locator('.hooks-event-group').first()).toBeVisible({ timeout: 8000 })

    // Find our test hook by description text in the card
    const testHookCard = page.locator('.item-card', {
      has: page.locator('.hooks-action-preview', { hasText: 'echo test-hook-e2e' })
    })

    if (await testHookCard.count() === 0) {
      console.log('⚠ Test hook not found (may not have been created in this run). Skipping delete test.')
      test.skip()
      return
    }

    // Click Delete (not the card itself)
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm')
      await dialog.accept()
    })

    const deleteBtn = testHookCard.locator('button.btn-danger', { hasText: 'Delete' })
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // Card should disappear
    await expect(testHookCard).not.toBeVisible({ timeout: 5000 })

    console.log('✓ E2E test hook deleted successfully')
  })

  test('7. Cancel from editor returns to hooks list without saving', async ({ page }) => {
    await selectClaudeCode(page)
    await goToHooks(page)

    await expect(page.locator('.page-title', { hasText: 'Hooks' })).toBeVisible()
    const hookCountBefore = await page.locator('.item-card').count()

    // Open new hook form
    await page.locator('.btn-primary', { hasText: 'New Hook' }).click()
    await expect(page.locator('h2', { hasText: 'New Hook' })).toBeVisible()

    // Fill in matcher
    await page.locator('input[placeholder*="Write|Edit"]').fill('Cancel|Test')

    // Click Cancel instead of Save
    await page.locator('button', { hasText: 'Cancel' }).click()

    // Should return to list
    await expect(page.locator('.page-title', { hasText: 'Hooks' })).toBeVisible()

    // Hook count should NOT have increased
    const hookCountAfter = await page.locator('.item-card').count()
    expect(hookCountAfter).toBe(hookCountBefore)

    console.log('✓ Cancel returns to list without creating a hook')
  })

  test('8. Regression: Rules tab still works after navigating Hooks', async ({ page }) => {
    await selectClaudeCode(page)
    await goToHooks(page)

    // Verify Hooks page loaded
    await expect(page.locator('.page-title', { hasText: 'Hooks' })).toBeVisible({ timeout: 8000 })

    // Navigate to Rules
    const rulesNav = page.locator('.sidebar-nav-item', { hasText: 'Rules' })
    await expect(rulesNav).toBeVisible()
    await rulesNav.click()

    // Rules page should load
    await expect(page.locator('.page-title', { hasText: 'Rules' })).toBeVisible({ timeout: 8000 })

    // Rules should be listed
    const ruleCards = page.locator('.item-card')
    await expect(ruleCards.first()).toBeVisible({ timeout: 8000 })
    const ruleCount = await ruleCards.count()
    expect(ruleCount).toBeGreaterThan(0)

    console.log(`✓ Rules tab regression: ${ruleCount} rules visible after navigating from Hooks`)
  })
})
