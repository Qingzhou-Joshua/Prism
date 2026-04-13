import type { ImportableRule, UnifiedRule } from '@prism/shared'

/**
 * Initial statuses ('new' | 'conflict-skip') are set by detectConflicts().
 * Remaining statuses are assigned by the import pipeline after user resolution.
 */
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
    const match = existing.find((existingRule) => existingRule.name === rule.name)
    if (match) {
      return { rule, status: 'conflict-skip', existingId: match.id }
    }
    return { rule, status: 'new' }
  })
}
