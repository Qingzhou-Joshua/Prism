import { describe, it, expect } from 'vitest'
import type { ImportableRule, UnifiedRule } from '@prism/shared'
import { detectConflicts } from './conflictDetection.js'

// Helper to create a minimal UnifiedRule
function makeRule(id: string, name: string): UnifiedRule {
  return {
    id,
    name,
    content: '',
    tags: [],
    createdAt: '',
    updatedAt: '',
    scope: 'global',
    platformOverrides: {},
  }
}

// Helper to create a minimal ImportableRule
function makeImportable(name: string, fileName: string): ImportableRule {
  return { name, content: 'content', fileName }
}

describe('detectConflicts', () => {
  it('marks rule as new when no existing rule has the same name', () => {
    const importable = [makeImportable('coding style', 'coding-style.md')]
    const existing: UnifiedRule[] = []
    const result = detectConflicts(importable, existing)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('new')
    expect(result[0].existingId).toBeUndefined()
  })

  it('marks rule as conflict-skip when existing rule has same name', () => {
    const importable = [makeImportable('coding style', 'coding-style.md')]
    const existing = [makeRule('rule-1', 'coding style')]
    const result = detectConflicts(importable, existing)
    expect(result[0].status).toBe('conflict-skip')
    expect(result[0].existingId).toBe('rule-1')
  })

  it('handles mixed new and conflict rules', () => {
    const importable = [
      makeImportable('coding style', 'coding-style.md'),
      makeImportable('security', 'security.md'),
    ]
    const existing = [makeRule('rule-1', 'coding style')]
    const result = detectConflicts(importable, existing)
    expect(result[0].status).toBe('conflict-skip')
    expect(result[1].status).toBe('new')
  })

  it('returns empty array for empty importable list', () => {
    // Arrange
    const existing = [makeRule('rule-1', 'coding style')]

    // Act
    const result = detectConflicts([], existing)

    // Assert
    expect(result).toHaveLength(0)
  })

  it('is case-sensitive: different case means new rule', () => {
    const importable = [makeImportable('TypeScript', 'TypeScript.md')]
    const existing = [makeRule('rule-1', 'typescript')]
    const result = detectConflicts(importable, existing)
    expect(result[0].status).toBe('new')
  })

  it('preserves the original ImportableRule in result', () => {
    const rule = makeImportable('coding style', 'coding-style.md')
    const result = detectConflicts([rule], [])
    expect(result[0].rule).toBe(rule)
  })

  it('preserves the original ImportableRule in result when conflict is detected', () => {
    // Arrange
    const rule = makeImportable('coding style', 'coding-style.md')
    const existing = [makeRule('rule-1', 'coding style')]

    // Act
    const result = detectConflicts([rule], existing)

    // Assert
    expect(result[0].rule).toBe(rule)
  })
})
