import { describe, it, expect } from 'vitest'
import type { UnifiedRule } from '@prism/shared'
import { projectRule } from './project.js'

function makeRule(overrides: Partial<UnifiedRule> = {}): UnifiedRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    content: 'default content',
    scope: 'global',
    tags: [],
    platformOverrides: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('projectRule', () => {
  it('returns default content when no override exists', () => {
    const rule = makeRule()
    const projection = projectRule(rule, 'cursor')
    expect(projection.content).toBe('default content')
    expect(projection.hidden).toBe(false)
  })

  it('returns override content when override exists', () => {
    const rule = makeRule({
      platformOverrides: { cursor: { content: 'cursor-specific content' } },
    })
    const projection = projectRule(rule, 'cursor')
    expect(projection.content).toBe('cursor-specific content')
    expect(projection.hidden).toBe(false)
  })

  it('marks projection hidden when override content is null', () => {
    const rule = makeRule({
      platformOverrides: { cursor: { content: null } },
    })
    const projection = projectRule(rule, 'cursor')
    expect(projection.content).toBeNull()
    expect(projection.hidden).toBe(true)
  })

  it('does not apply other platform overrides', () => {
    const rule = makeRule({
      platformOverrides: { cursor: { content: 'cursor override' } },
    })
    const projection = projectRule(rule, 'claude-code')
    expect(projection.content).toBe('default content')
    expect(projection.hidden).toBe(false)
  })

  it('includes rule metadata in projection', () => {
    const rule = makeRule({ id: 'abc', name: 'My Rule', scope: 'project' })
    const projection = projectRule(rule, 'cursor')
    expect(projection.ruleId).toBe('abc')
    expect(projection.name).toBe('My Rule')
    expect(projection.platformId).toBe('cursor')
    expect(projection.scope).toBe('project')
  })
})
