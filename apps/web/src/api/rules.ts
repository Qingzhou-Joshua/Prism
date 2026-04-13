import type { UnifiedRule, CreateRuleDto, UpdateRuleDto } from '@prism/shared'

const API_BASE = 'http://localhost:3001'

export interface RuleProjectionItem {
  platformId: string
  content: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const rulesApi = {
  list(): Promise<UnifiedRule[]> {
    return request<UnifiedRule[]>('/rules').then(r => r ?? [])
  },
  get(id: string): Promise<UnifiedRule | null> {
    return request<UnifiedRule>(`/rules/${id}`)
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
    return request<RuleProjectionItem[]>(`/rules/${id}/projections`).then(r => r ?? [])
  },
}
