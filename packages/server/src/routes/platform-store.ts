import { getPlatformInstances, type PlatformInstance } from '@prism/core'
import type { PlatformId } from '@prism/shared'

/** Default platform when a request omits `?platform=` — the first discovered instance. */
export function defaultPlatformId(): PlatformId {
  return getPlatformInstances()[0]?.id ?? 'claude-code'
}

export function resolvePlatformId(platform: unknown): PlatformId {
  return typeof platform === 'string' && platform !== '' ? platform : defaultPlatformId()
}

/**
 * Pick the store for `?platform=`. Unknown or unsupported platforms produce a
 * 404 instead of silently falling back to another platform's files.
 */
export function pickStore<T>(stores: Map<string, T>, platform: unknown): T {
  const id = resolvePlatformId(platform)
  const store = stores.get(id)
  if (!store) {
    throw Object.assign(new Error(`Platform '${id}' not found or does not support this asset type`), { statusCode: 404 })
  }
  return store
}

/** Ids of discovered platforms that support the given asset directory/config. */
export function platformIdsWith(key: keyof Pick<PlatformInstance, 'rulesDir' | 'skillsDir' | 'agentsDir' | 'commandsDir' | 'mcp' | 'plugins' | 'hooksSettingsPath'>): PlatformId[] {
  return getPlatformInstances().filter(p => p[key] !== null).map(p => p.id)
}
