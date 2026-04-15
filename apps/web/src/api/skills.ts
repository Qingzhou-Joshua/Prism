import type { UnifiedSkill, CreateSkillDto, UpdateSkillDto } from '@prism/shared'
import { request } from './client.js'

export interface SkillProjectionItem {
  platformId: string
  fileName: string
  content: string
}

function platformQuery(platform?: string): string {
  return platform ? `?platform=${encodeURIComponent(platform)}` : ''
}

export const skillsApi = {
  list(platform?: string): Promise<UnifiedSkill[]> {
    return request<{ items: UnifiedSkill[] }>(`/skills${platformQuery(platform)}`).then(r => r?.items ?? [])
  },
  async get(id: string, platform?: string): Promise<UnifiedSkill | null> {
    try {
      return await request<UnifiedSkill>(`/skills/${id}${platformQuery(platform)}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },
  create(dto: CreateSkillDto, platform?: string): Promise<UnifiedSkill> {
    return request<UnifiedSkill>(`/skills${platformQuery(platform)}`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },
  update(id: string, dto: UpdateSkillDto, platform?: string): Promise<UnifiedSkill> {
    return request<UnifiedSkill>(`/skills/${id}${platformQuery(platform)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },
  delete(id: string, platform?: string): Promise<void> {
    return request<null>(`/skills/${id}${platformQuery(platform)}`, { method: 'DELETE' }).then(() => undefined)
  },
  projections(id: string, platform?: string): Promise<SkillProjectionItem[]> {
    return request<{ projections: SkillProjectionItem[] }>(`/skills/${id}/projections${platformQuery(platform)}`).then(r => r?.projections ?? [])
  },
}
