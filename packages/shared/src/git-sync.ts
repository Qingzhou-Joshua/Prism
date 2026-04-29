import type { RegistryEntry, AssetType, Registry } from './registry.js'

export interface GitSyncConfig {
  remoteUrl: string
  branch: string
  autoSync?: boolean
  lastSyncAt?: string
}

export type SyncStatus = 'idle' | 'pushing' | 'pulling' | 'conflict-detected' | 'synced' | 'error'

export interface SyncState {
  status: SyncStatus
  message?: string
  lastSyncAt?: string
  lastPushAt?: string
  lastPullAt?: string
  conflictKey?: string
}

export interface RegistryDiff {
  added: RegistryEntry[]
  removed: RegistryEntry[]
  modified: Array<{ local: RegistryEntry; remote: RegistryEntry }>
}

export interface GitConflict {
  key: string          // "${type}:${normalizedName}"
  type: AssetType
  name: string
  local: RegistryEntry | null
  remote: RegistryEntry | null
}

export type ConflictResolution = 'keep-local' | 'keep-remote' | 'merge'

export interface GitConflictResolution {
  key: string
  resolution: ConflictResolution
  mergedContent?: string
}

export interface PrismExportPackage {
  version: '1'
  exportedAt: string
  machine?: string
  registry: Registry
  overrides: Record<string, string>
  knowledge: Record<string, string>
}

export interface GitInitResult {
  success: boolean
  message: string
  config?: GitSyncConfig
  registryRebuilt?: boolean
}

export interface PrePullCheck {
  hasLocalChanges: boolean
  hasRemoteChanges: boolean
  conflictsDetected: GitConflict[]
}
