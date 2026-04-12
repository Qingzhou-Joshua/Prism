import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'adapter-codebuddy',
    include: ['src/**/*.test.ts'],
  },
})
