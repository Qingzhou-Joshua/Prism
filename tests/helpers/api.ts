/** Low-level API helpers for Playwright tests.
 *  All calls go directly to the Fastify server (:3001), bypassing the browser.
 */

export const API_BASE = 'http://localhost:3001'

export async function resetRegistry(): Promise<void> {
  const res = await fetch(`${API_BASE}/registry`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    throw new Error(`resetRegistry failed: ${res.status}`)
  }
}

export async function scanRegistry(): Promise<{ indexed: number; errors: string[]; scannedAt: string }> {
  const res = await fetch(`${API_BASE}/registry/scan`, { method: 'POST' })
  if (!res.ok) throw new Error(`scanRegistry failed: ${res.status}`)
  return res.json()
}

export async function getRegistry(): Promise<{ entries: unknown[]; lastUpdated: string }> {
  const res = await fetch(`${API_BASE}/registry`)
  if (!res.ok) throw new Error(`getRegistry failed: ${res.status}`)
  return res.json()
}

export async function getConflicts(): Promise<{ conflicts: unknown[] }> {
  const res = await fetch(`${API_BASE}/registry/conflicts`)
  if (!res.ok) throw new Error(`getConflicts failed: ${res.status}`)
  return res.json()
}

export interface CreateRulePayload {
  name: string
  content: string
  scope?: 'global' | 'platform-only' | 'override'
  targetPlatforms?: string[]
}

export interface RuleResponse {
  id: string
  name: string
  content: string
  scope: string
  targetPlatforms: string[]
}

export async function createRule(
  payload: CreateRulePayload,
  platform = 'claude-code',
): Promise<RuleResponse> {
  const res = await fetch(`${API_BASE}/rules?platform=${platform}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'global', ...payload }),
  })
  if (!res.ok) throw new Error(`createRule failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function deleteRule(id: string, platform = 'claude-code'): Promise<void> {
  const res = await fetch(`${API_BASE}/rules/${id}?platform=${platform}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteRule failed: ${res.status}`)
  }
}

export async function setOverride(
  platformId: string,
  assetType: string,
  id: string,
  content: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/overrides/${platformId}/${assetType}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error(`setOverride failed: ${res.status}`)
}

// ── Hooks helpers ─────────────────────────────────────────────────────────────

export interface CreateHookPayload {
  eventType: string
  matcher: string
  description?: string
  actions: Array<{ type: string; command: string }>
}

export interface HookResponse {
  id: string
  eventType: string
  matcher: string
  description?: string
  actions: Array<{ type: string; command: string }>
  platformId: string
  createdAt: string
  updatedAt: string
}

export async function createHook(
  payload: CreateHookPayload,
  platform = 'claude-code',
): Promise<HookResponse> {
  const res = await fetch(`${API_BASE}/hooks?platform=${platform}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`createHook failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function deleteHook(id: string, platform = 'claude-code'): Promise<void> {
  const res = await fetch(`${API_BASE}/hooks/${id}?platform=${platform}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteHook failed: ${res.status}`)
  }
}

export async function deleteOverride(
  platformId: string,
  assetType: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/overrides/${platformId}/${assetType}/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteOverride failed: ${res.status}`)
  }
}
