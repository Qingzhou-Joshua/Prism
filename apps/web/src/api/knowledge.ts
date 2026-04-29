import { request } from './client.js'
import type { DeveloperProfile, KnowledgeEntry, GeneratedAsset } from '@prism/shared'

export interface KnowledgeEntriesFilter {
  domain?: string
  projectPath?: string
  since?: string
}

function buildQuery(filter?: KnowledgeEntriesFilter): string {
  if (!filter) return ''
  const params = new URLSearchParams()
  if (filter.domain) params.set('domain', filter.domain)
  if (filter.projectPath) params.set('projectPath', filter.projectPath)
  if (filter.since) params.set('since', filter.since)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const knowledgeApi = {
  async getProfile(): Promise<DeveloperProfile> {
    const result = await request<DeveloperProfile>('/knowledge/profile')
    return result ?? { bio: '', skills: [], updatedAt: new Date().toISOString() }
  },

  async updateProfile(dto: Partial<DeveloperProfile>): Promise<DeveloperProfile> {
    const result = await request<DeveloperProfile>('/knowledge/profile', {
      method: 'PUT',
      body: JSON.stringify(dto),
    })
    if (!result) throw new Error('Failed to update profile')
    return result
  },

  async listEntries(filter?: KnowledgeEntriesFilter): Promise<KnowledgeEntry[]> {
    const result = await request<{ items: KnowledgeEntry[] }>(`/knowledge/entries${buildQuery(filter)}`)
    return result?.items ?? []
  },

  async getEntry(id: string): Promise<KnowledgeEntry | null> {
    try {
      return await request<KnowledgeEntry>(`/knowledge/entries/${id}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },

  async deleteEntry(id: string): Promise<void> {
    await request<null>(`/knowledge/entries/${id}`, { method: 'DELETE' })
  },

  async setupHook(platforms: string[]): Promise<{ configured: string[]; alreadyConfigured: string[] }> {
    const result = await request<{ configured: string[]; alreadyConfigured: string[] }>(
      '/knowledge/setup-hook',
      { method: 'POST', body: JSON.stringify({ platforms }) },
    )
    if (!result) throw new Error('Failed to setup hook')
    return result
  },

  async teardownHook(platforms: string[]): Promise<{ removed: string[] }> {
    const result = await request<{ removed: string[] }>(
      '/knowledge/teardown-hook',
      { method: 'POST', body: JSON.stringify({ platforms }) },
    )
    if (!result) throw new Error('Failed to teardown hook')
    return result
  },

  async getHookStatus(platforms?: string[]): Promise<{ enabled: boolean; platforms: Record<string, boolean> }> {
    const qs = platforms ? `?platforms=${platforms.join(',')}` : ''
    const result = await request<{ enabled: boolean; platforms: Record<string, boolean> }>(
      `/knowledge/hook-status${qs}`,
    )
    return result ?? { enabled: false, platforms: {} }
  },

  async listGenerated(): Promise<GeneratedAsset[]> {
    const result = await request<{ items: GeneratedAsset[] }>('/knowledge/generated')
    return result?.items ?? []
  },

  async generateProfileRule(): Promise<GeneratedAsset> {
    const result = await request<GeneratedAsset>('/knowledge/generate/profile-rule', {
      method: 'POST',
    })
    if (!result) throw new Error('Failed to generate profile rule')
    return result
  },

  async generateProjectRule(dto: { domain?: string; projectPath?: string }): Promise<GeneratedAsset> {
    const result = await request<GeneratedAsset>('/knowledge/generate/project-rule', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
    if (!result) throw new Error('Failed to generate project rule')
    return result
  },

  async publishGenerated(id: string, dto: { platformId: string; assetType: 'rule' | 'skill' }): Promise<GeneratedAsset> {
    const result = await request<GeneratedAsset>(`/knowledge/generated/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(dto),
    })
    if (!result) throw new Error('Failed to publish generated asset')
    return result
  },

  async deleteGenerated(id: string): Promise<void> {
    await request<null>(`/knowledge/generated/${id}`, { method: 'DELETE' })
  },
}
