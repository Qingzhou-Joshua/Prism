import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/shared/vitest.config.ts',
      'packages/core/vitest.config.ts',
      'packages/adapters/adapter-openclaw/vitest.config.ts',
      'packages/adapters/adapter-codebuddy/vitest.config.ts',
      'packages/adapters/adapter-claude-code/vitest.config.ts',
      'packages/server/vitest.config.ts',
    ],
  },
})
