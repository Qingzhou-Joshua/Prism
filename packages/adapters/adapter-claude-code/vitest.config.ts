import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'adapter-claude-code',
    include: ['src/**/*.test.ts'],
  },
})
