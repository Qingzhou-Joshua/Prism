import type { PlatformId } from './platform.js'
import type { RuleScope } from './rule.js'

export type AssetType = 'rule' | 'skill' | 'agent' | 'mcp' | 'hook'

export interface RegistryEntry {
  id: string
  type: AssetType
  name: string
  filePath: string
  platformId: PlatformId
  scope: RuleScope | 'global'  // non-rules always use 'global'
  tags: string[]
  targetPlatforms: string[]
  checksum: string  // first 12 chars of sha256 of file content
  createdAt: string
  updatedAt: string
  indexedAt: string  // when Prism last indexed this entry
}

export interface Registry {
  version: '1'
  entries: RegistryEntry[]
  lastUpdated: string
}

export interface ConflictGroup {
  key: string           // `${type}:${normalizedName}` e.g. "rule:typescript-patterns"
  type: AssetType
  name: string
  entries: RegistryEntry[]  // 2+ entries with same type+name from different platforms
}

export interface WatcherChangeEvent {
  entryId: string
  filePath: string
  platformId: string
  assetType: AssetType
  assetName: string
  detectedAt: string  // ISO timestamp
}
