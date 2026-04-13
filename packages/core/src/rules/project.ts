import type { UnifiedRule, RuleScope } from '@prism/shared'

export type RuleProjection = {
  ruleId: string
  name: string
  platformId: string
  content: string | null
  hidden: boolean
  scope: RuleScope
}

export function projectRule(rule: UnifiedRule, platformId: string): RuleProjection {
  const override = rule.platformOverrides[platformId as keyof typeof rule.platformOverrides]
  if (override !== undefined) {
    const content = override.content as string | null
    return {
      ruleId: rule.id,
      name: rule.name,
      platformId,
      content,
      hidden: content === null,
      scope: rule.scope,
    }
  }
  return {
    ruleId: rule.id,
    name: rule.name,
    platformId,
    content: rule.content,
    hidden: false,
    scope: rule.scope,
  }
}
