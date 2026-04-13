import type { PlatformId } from './platform.js'

export type RuleScope = 'global' | 'project'

/** 可扩展结构，预留 enabled/priority 等字段 */
export interface PlatformOverride {
  content: string
}

export interface UnifiedRule {
  id: string
  name: string
  content: string
  scope: RuleScope
  tags: string[]
  platformOverrides: Partial<Record<PlatformId, PlatformOverride>>
  /** ISO 8601 格式，e.g. "2025-01-01T00:00:00.000Z" */
  createdAt: string
  /** ISO 8601 格式，e.g. "2025-01-01T00:00:00.000Z" */
  updatedAt: string
}

export interface CreateRuleDto {
  name: string
  content: string
  scope: RuleScope
  tags?: string[]
  platformOverrides?: Partial<Record<PlatformId, PlatformOverride>>
}

export interface UpdateRuleDto {
  name?: string
  content?: string
  scope?: RuleScope
  tags?: string[]
  platformOverrides?: Partial<Record<PlatformId, PlatformOverride>>
}
