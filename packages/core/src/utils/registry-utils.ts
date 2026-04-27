import type { RegistryEntry } from '@prism/shared'
import type { PlatformId } from '@prism/shared'
import type { UnifiedRule } from '@prism/shared'
import type { UnifiedSkill } from '@prism/shared'
import type { UnifiedAgent } from '@prism/shared'
import { computeChecksum } from '../registry/registry-store.js'

/** Convert a UnifiedRule to a RegistryEntry */
export function ruleToEntry(rule: UnifiedRule, platformId: PlatformId): RegistryEntry {
  return {
    id: rule.id,
    type: 'rule',
    name: rule.name,
    filePath: rule.filePath ?? '',
    platformId,
    scope: rule.scope,
    tags: rule.tags,
    targetPlatforms: rule.targetPlatforms,
    checksum: computeChecksum(rule.content),
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    indexedAt: new Date().toISOString(),
  }
}

/** Convert a UnifiedSkill to a RegistryEntry */
export function skillToEntry(skill: UnifiedSkill, platformId: PlatformId): RegistryEntry {
  return {
    id: skill.id,
    type: 'skill',
    name: skill.name,
    filePath: skill.filePath ?? '',
    platformId,
    scope: 'global',
    tags: skill.tags ?? [],
    targetPlatforms: skill.targetPlatforms ?? [],
    checksum: computeChecksum(skill.content),
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    indexedAt: new Date().toISOString(),
  }
}

/** Convert a UnifiedAgent to a RegistryEntry */
export function agentToEntry(agent: UnifiedAgent, platformId: PlatformId): RegistryEntry {
  return {
    id: agent.id,
    type: 'agent',
    name: agent.name,
    filePath: agent.filePath ?? '',
    platformId,
    scope: 'global',
    tags: agent.tags ?? [],
    targetPlatforms: agent.targetPlatforms ?? [],
    checksum: computeChecksum(agent.content),
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    indexedAt: new Date().toISOString(),
  }
}
