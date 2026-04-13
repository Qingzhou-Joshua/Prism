import type { UnifiedSkill, CreateSkillDto, UpdateSkillDto } from '@prism/shared'
import { request } from './client.js'

export interface SkillProjectionItem {
  platformId: string
  fileName: string
  content: string
}

export const skillsApi = {
  list(): Promise<UnifiedSkill[]> {
    return request<{ items: UnifiedSkill[] }>('/skills').then(r => r?.items ?? [])
  },
  async get(id: string): Promise<UnifiedSkill | null> {
    try {
      return await request<UnifiedSkill>(`/skills/${id}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },
  create(dto: CreateSkillDto): Promise<UnifiedSkill> {
    return request<UnifiedSkill>('/skills', {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },
  update(id: string, dto: UpdateSkillDto): Promise<UnifiedSkill> {
    return request<UnifiedSkill>(`/skills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },
  delete(id: string): Promise<void> {
    return request<null>(`/skills/${id}`, { method: 'DELETE' }).then(() => undefined)
  },
  projections(id: string): Promise<SkillProjectionItem[]> {
    return request<{ projections: SkillProjectionItem[] }>(`/skills/${id}/projections`).then(r => r?.projections ?? [])
  },
}
