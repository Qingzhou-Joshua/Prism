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
  // If rule is targeted to specific platforms and this platform is not in the list, hide it
  if (rule.targetPlatforms && rule.targetPlatforms.length > 0 && !rule.targetPlatforms.includes(platformId)) {
    return {
      ruleId: rule.id,
      name: rule.name,
      platformId,
      content: null,
      hidden: true,
      scope: rule.scope,
    }
  }
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
