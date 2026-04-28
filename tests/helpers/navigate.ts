/** Navigation helpers for Playwright tests. */
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Wait for platform tabs to load and click the given platform. */
export async function selectPlatform(page: Page, platformName: string): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.platform-tab').first()).toBeVisible({ timeout: 10000 })
  const tab = page.locator('.platform-tab', { hasText: platformName })
  await expect(tab).toBeVisible()
  await tab.click()
}

/** Click a sidebar nav item by label. Assumes platform is already selected. */
export async function goToPage(page: Page, label: string): Promise<void> {
  const navItem = page.locator('.sidebar-nav-item', { hasText: label })
  await expect(navItem).toBeVisible({ timeout: 5000 })
  await navItem.click()
}

/** Select Claude Code and navigate to a sidebar section. */
export async function navigateTo(page: Page, section: string): Promise<void> {
  await selectPlatform(page, 'Claude Code')
  await goToPage(page, section)
}
