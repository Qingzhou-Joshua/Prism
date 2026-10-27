// Platform display names are discovered by the server (GET /platforms) —
// App populates this map once the scan returns.
export const PLATFORM_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  codebuddy: 'CodeBuddy',
  cursor: 'Cursor',
  codex: 'Codex',
  opencode: 'OpenCode',
}

export function registerPlatformLabels(items: { id: string; displayName: string }[]): void {
  for (const p of items) PLATFORM_LABELS[p.id] = p.displayName
}

export function platformLabel(id: string): string {
  return PLATFORM_LABELS[id] ?? id
}

interface DiscoveredPlatform {
  id: string
  displayName: string
  detected?: boolean
  capabilities?: object
}

const discovered: DiscoveredPlatform[] = []

/** Called by App with the GET /platforms result. */
export function registerDiscoveredPlatforms(items: DiscoveredPlatform[]): void {
  discovered.splice(0, discovered.length, ...items.filter(p => p.detected !== false))
  registerPlatformLabels(items)
}

/** Ids of detected platforms, optionally only those with a capability (e.g. 'rules', 'hooks'). */
export function discoveredPlatformIds(capability?: string): string[] {
  return discovered.filter(p => !capability || (p.capabilities as Record<string, unknown> | undefined)?.[capability]).map(p => p.id)
}
