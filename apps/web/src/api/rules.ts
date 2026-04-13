import type { UnifiedRule, CreateRuleDto, UpdateRuleDto } from '@prism/shared'
import { request } from './client.js'

export interface RuleProjectionItem {
  platformId: string
  content: string | null
}

export const rulesApi = {
  list(): Promise<UnifiedRule[]> {
    return request<{ items: UnifiedRule[] }>('/rules').then(r => r?.items ?? [])
  },
  async get(id: string): Promise<UnifiedRule | null> {
    try {
      return await request<UnifiedRule>(`/rules/${id}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },
  create(dto: CreateRuleDto): Promise<UnifiedRule> {
    return request<UnifiedRule>('/rules', {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },
  update(id: string, dto: UpdateRuleDto): Promise<UnifiedRule> {
    return request<UnifiedRule>(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },
  delete(id: string): Promise<void> {
    return request<null>(`/rules/${id}`, { method: 'DELETE' }).then(() => undefined)
  },
  projections(id: string): Promise<RuleProjectionItem[]> {
    return request<{ projections: RuleProjectionItem[] }>(`/rules/${id}/projections`).then(r => r?.projections ?? [])
  },
}
