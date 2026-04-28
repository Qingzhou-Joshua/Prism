/** Shared test fixtures for Prism E2E tests. */
import { test as base } from '@playwright/test'
import { resetRegistry, deleteRule } from './helpers/api.js'

interface PrismFixtures {
  /** Resets the registry before each test. */
  cleanRegistry: void
  /** Tracks rule IDs created during a test and deletes them on cleanup. */
  ruleTracker: {
    track: (id: string, platform?: string) => void
    ids: Array<{ id: string; platform: string }>
  }
}

export const test = base.extend<PrismFixtures>({
  cleanRegistry: [
    async ({}, use) => {
      await resetRegistry()
      await use()
    },
    { auto: false },
  ],

  ruleTracker: async ({}, use) => {
    const ids: Array<{ id: string; platform: string }> = []
    const tracker = {
      track(id: string, platform = 'claude-code') {
        ids.push({ id, platform })
      },
      ids,
    }
    await use(tracker)
    // Cleanup: delete all tracked rules
    for (const { id, platform } of ids) {
      await deleteRule(id, platform).catch(() => {/* already deleted is fine */})
    }
  },
})

export { expect } from '@playwright/test'
