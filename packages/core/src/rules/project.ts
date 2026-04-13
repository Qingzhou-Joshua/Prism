import type { UnifiedRule, RuleScope, PlatformId } from '@prism/shared'

export type RuleProjection = {
  ruleId: string
  name: string
  platformId: string
  content: string | null
  hidden: boolean
  scope: RuleScope
}

export function projectRule(rule: UnifiedRule, platformId: PlatformId): RuleProjection {
  const override = rule.platformOverrides[platformId]
  if (override !== undefined) {
    const content = override.content
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
