import type { UnifiedAgent, CreateAgentDto, UpdateAgentDto } from '@prism/shared'
import { request } from './client.js'

export interface AgentProjectionItem {
  platformId: string
  fileName: string
  content: string
}

export const agentsApi = {
  list(): Promise<UnifiedAgent[]> {
    return request<{ items: UnifiedAgent[] }>('/agents').then(r => r?.items ?? [])
  },

  async get(id: string): Promise<UnifiedAgent | null> {
    try {
      return await request<UnifiedAgent>(`/agents/${id}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },

  create(dto: CreateAgentDto): Promise<UnifiedAgent> {
    return request<UnifiedAgent>('/agents', {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  update(id: string, dto: UpdateAgentDto): Promise<UnifiedAgent> {
    return request<UnifiedAgent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  delete(id: string): Promise<void> {
    return request<null>(`/agents/${id}`, { method: 'DELETE' }).then(() => undefined)
  },

  projections(id: string): Promise<AgentProjectionItem[]> {
    return request<{ projections: AgentProjectionItem[] }>(`/agents/${id}/projections`).then(
      r => r?.projections ?? [],
    )
  },
}
