import type { UnifiedAgent, CreateAgentDto, UpdateAgentDto } from '@prism/shared'
import { request } from './client.js'

export interface AgentProjectionItem {
  platformId: string
  fileName: string
  content: string
}

function platformQuery(platform?: string): string {
  return platform ? `?platform=${encodeURIComponent(platform)}` : ''
}

export const agentsApi = {
  list(platform?: string): Promise<UnifiedAgent[]> {
    return request<{ items: UnifiedAgent[] }>(`/agents${platformQuery(platform)}`).then(r => r?.items ?? [])
  },

  async get(id: string, platform?: string): Promise<UnifiedAgent | null> {
    try {
      return await request<UnifiedAgent>(`/agents/${id}${platformQuery(platform)}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },

  create(dto: CreateAgentDto, platform?: string): Promise<UnifiedAgent> {
    return request<UnifiedAgent>(`/agents${platformQuery(platform)}`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  update(id: string, dto: UpdateAgentDto, platform?: string): Promise<UnifiedAgent> {
    return request<UnifiedAgent>(`/agents/${id}${platformQuery(platform)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  delete(id: string, platform?: string): Promise<void> {
    return request<null>(`/agents/${id}${platformQuery(platform)}`, { method: 'DELETE' }).then(() => undefined)
  },

  projections(id: string, platform?: string): Promise<AgentProjectionItem[]> {
    return request<{ projections: AgentProjectionItem[] }>(`/agents/${id}/projections${platformQuery(platform)}`).then(
      r => r?.projections ?? [],
    )
  },
}
