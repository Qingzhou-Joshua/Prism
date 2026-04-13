import type { ImportableRule } from '@prism/shared'
import type { UnifiedRule } from '@prism/shared'

export type RuleStatus = 'new' | 'conflict-skip' | 'conflict-overwrite' | 'imported' | 'failed' | 'skipped'

export interface ConflictResult {
  rule: ImportableRule
  status: RuleStatus
  existingId?: string
}

export function detectConflicts(
  importable: ImportableRule[],
  existing: UnifiedRule[],
): ConflictResult[] {
  return importable.map((rule) => {
    const match = existing.find((e) => e.name === rule.name)
    if (match) {
      return { rule, status: 'conflict-skip', existingId: match.id }
    }
    return { rule, status: 'new' }
  })
}
