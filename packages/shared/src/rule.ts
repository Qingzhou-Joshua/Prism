export type RuleScope = 'global' | 'project'

export interface PlatformOverride {
  content: string
}

export interface UnifiedRule {
  id: string
  name: string
  content: string
  scope: RuleScope
  tags: string[]
  platformOverrides: Partial<Record<string, PlatformOverride>>
  createdAt: string
  updatedAt: string
}

export interface CreateRuleDto {
  name: string
  content: string
  scope: RuleScope
  tags?: string[]
  platformOverrides?: Partial<Record<string, PlatformOverride>>
}

export interface UpdateRuleDto {
  name?: string
  content?: string
  scope?: RuleScope
  tags?: string[]
  platformOverrides?: Partial<Record<string, PlatformOverride>>
}
