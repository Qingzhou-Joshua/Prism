import type { UnifiedRule, CreateRuleDto, UpdateRuleDto } from '@prism/shared'
import { request } from './client.js'

export interface RuleProjectionItem {
  platformId: string
  content: string | null
}

function platformQuery(platform?: string): string {
  return platform ? `?platform=${encodeURIComponent(platform)}` : ''
}

export const rulesApi = {
  list(platform?: string): Promise<UnifiedRule[]> {
    return request<{ items: UnifiedRule[] }>(`/rules${platformQuery(platform)}`).then(r => r?.items ?? [])
  },
  async get(id: string, platform?: string): Promise<UnifiedRule | null> {
    try {
      return await request<UnifiedRule>(`/rules/${id}${platformQuery(platform)}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },
  create(dto: CreateRuleDto, platform?: string): Promise<UnifiedRule> {
    return request<UnifiedRule>(`/rules${platformQuery(platform)}`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },
  update(id: string, dto: UpdateRuleDto, platform?: string): Promise<UnifiedRule> {
    return request<UnifiedRule>(`/rules/${id}${platformQuery(platform)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },
  delete(id: string, platform?: string): Promise<void> {
    return request<null>(`/rules/${id}${platformQuery(platform)}`, { method: 'DELETE' }).then(() => undefined)
  },
  projections(id: string, platform?: string): Promise<RuleProjectionItem[]> {
    return request<{ projections: RuleProjectionItem[] }>(`/rules/${id}/projections${platformQuery(platform)}`).then(r => r?.projections ?? [])
  },
}
