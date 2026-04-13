import { describe, it, expect } from 'vitest'
import { parseSkillFile } from './parse.js'

describe('parseSkillFile', () => {
  it('parses all fields from front matter', () => {
    const raw = `---
trigger: /deploy
category: devops
description: Deploy to production
arguments:
  - environment
  - branch
---
Deploy the app to production.`

    const result = parseSkillFile(raw)
    expect(result.trigger).toBe('/deploy')
    expect(result.category).toBe('devops')
    expect(result.description).toBe('Deploy to production')
    expect(result.arguments).toEqual(['environment', 'branch'])
    expect(result.content).toBe('Deploy the app to production.')
  })

  it('returns content only when no front matter present', () => {
    const raw = 'Just some content without front matter.'
    const result = parseSkillFile(raw)
    expect(result.trigger).toBeUndefined()
    expect(result.category).toBeUndefined()
    expect(result.description).toBeUndefined()
    expect(result.arguments).toBeUndefined()
    expect(result.content).toBe('Just some content without front matter.')
  })

  it('handles partial front matter (only trigger)', () => {
    const raw = `---
trigger: /test
---
Run the tests.`

    const result = parseSkillFile(raw)
    expect(result.trigger).toBe('/test')
    expect(result.category).toBeUndefined()
    expect(result.arguments).toBeUndefined()
    expect(result.content).toBe('Run the tests.')
  })

  it('handles empty front matter block', () => {
    const raw = `---
---
Content here.`

    const result = parseSkillFile(raw)
    expect(result.trigger).toBeUndefined()
    expect(result.content).toBe('Content here.')
  })
})
