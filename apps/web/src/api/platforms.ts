import type { ImportedRule, PlatformId } from '@prism/shared'
import { request } from './client.js'

export const platformsApi = {
  importRules(platformId: PlatformId): Promise<ImportedRule[]> {
    return request<{ platformId: PlatformId; items: ImportedRule[] }>(
      `/platforms/${platformId}/rules`,
    ).then(r => r?.items ?? [])
  },
}
