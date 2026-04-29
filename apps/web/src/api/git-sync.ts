import { request } from './client.js'
import type {
  GitSyncConfig,
  SyncState,
  GitConflict,
  GitConflictResolution,
  ConflictResolution,
  PrePullCheck,
  GitInitResult,
} from '@prism/shared'

export const gitSyncApi = {
  getConfig: async (): Promise<{ config: GitSyncConfig | null }> => {
    const result = await request<{ config: GitSyncConfig | null }>('/git-sync/config')
    return result ?? { config: null }
  },

  initSync: async (remoteUrl: string, branch?: string): Promise<GitInitResult> => {
    const result = await request<GitInitResult>('/git-sync/init', {
      method: 'POST',
      body: JSON.stringify({ remoteUrl, branch: branch ?? 'main' }),
    })
    if (!result) throw new Error('Failed to initialize git sync')
    return result
  },

  getStatus: async (): Promise<SyncState> => {
    const result = await request<SyncState>('/git-sync/status')
    return result ?? { status: 'idle' }
  },

  prePullCheck: async (): Promise<PrePullCheck> => {
    const result = await request<PrePullCheck>('/git-sync/pre-pull-check')
    return result ?? { hasLocalChanges: false, hasRemoteChanges: false, conflictsDetected: [] }
  },

  pull: async (resolutions: GitConflictResolution[]): Promise<{ success: boolean; message?: string }> => {
    const result = await request<{ success: boolean; message?: string }>('/git-sync/pull', {
      method: 'POST',
      body: JSON.stringify({ resolutions }),
    })
    if (!result) throw new Error('Pull failed')
    return result
  },

  push: async (message: string): Promise<{ success: boolean; message?: string }> => {
    const result = await request<{ success: boolean; message?: string }>('/git-sync/push', {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
    if (!result) throw new Error('Push failed')
    return result
  },

  getConflicts: async (): Promise<{ conflicts: GitConflict[] }> => {
    const result = await request<{ conflicts: GitConflict[] }>('/git-sync/conflicts')
    return result ?? { conflicts: [] }
  },

  resolveConflict: async (key: string, resolution: ConflictResolution, mergedContent?: string): Promise<{ success: boolean; message?: string }> => {
    const result = await request<{ success: boolean; message?: string }>('/git-sync/resolve-conflict', {
      method: 'POST',
      body: JSON.stringify({ key, resolution, mergedContent }),
    })
    if (!result) throw new Error('Failed to resolve conflict')
    return result
  },

  cloneInit: async (remoteUrl: string, branch?: string): Promise<GitInitResult> => {
    const result = await request<GitInitResult>('/git-sync/clone-init', {
      method: 'POST',
      body: JSON.stringify({ remoteUrl, branch: branch ?? 'main' }),
    })
    if (!result) throw new Error('Clone init failed')
    return result
  },

  publishToIde: async (platformIds: string[]): Promise<{ success: boolean; publishedCount?: number; error?: string }> => {
    const result = await request<{ success: boolean; publishedCount?: number }>('/git-sync/publish-to-ide', {
      method: 'POST',
      body: JSON.stringify({ platformIds }),
    })
    if (!result) throw new Error('Publish to IDE failed')
    return result
  },

  deleteConfig: async (): Promise<void> => {
    await request<void>('/git-sync/config', { method: 'DELETE' })
  },
}
