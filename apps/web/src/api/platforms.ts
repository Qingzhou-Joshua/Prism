import type { ImportedRule, ImportedSkill, PlatformId } from '@prism/shared'
import { request } from './client.js'

export const platformsApi = {
  importRules(platformId: PlatformId): Promise<ImportedRule[]> {
    return request<{ platformId: PlatformId; items: ImportedRule[] }>(
      `/platforms/${platformId}/rules`,
    ).then(r => r?.items ?? [])
  },

  importSkills(platformId: PlatformId): Promise<ImportedSkill[]> {
    return request<{ platformId: PlatformId; items: ImportedSkill[] }>(
      `/platforms/${platformId}/skills`,
    ).then(r => r?.items ?? [])
  },
}
