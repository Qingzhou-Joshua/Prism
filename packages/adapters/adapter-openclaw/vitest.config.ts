import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'adapter-openclaw',
    include: ['src/**/*.test.ts'],
  },
})
