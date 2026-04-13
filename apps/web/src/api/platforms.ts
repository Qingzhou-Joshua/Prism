import type { ImportedRule, PlatformId } from '@prism/shared'

const API_BASE = 'http://localhost:3001'

async function request<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const platformsApi = {
  importRules(platformId: PlatformId): Promise<ImportedRule[]> {
    return request<{ platformId: PlatformId; items: ImportedRule[] }>(
      `/platforms/${platformId}/rules`,
    ).then(r => r?.items ?? [])
  },
}
