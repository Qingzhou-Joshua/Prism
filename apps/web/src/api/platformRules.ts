import type { ImportableRule } from '@prism/shared'
import { API_BASE } from './client.js'

export interface PlatformRulesResponse {
  platformId: string
  items: ImportableRule[]
}

export async function fetchPlatformRules(platformId: string): Promise<ImportableRule[]> {
  const res = await fetch(`${API_BASE}/platforms/${platformId}/rules`)
  if (res.status === 404) {
    return []
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  const data = (await res.json()) as PlatformRulesResponse
  return data.items ?? []
}
