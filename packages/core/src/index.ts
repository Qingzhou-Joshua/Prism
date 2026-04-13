import type { PlatformAdapter } from './types.js'

export type { PlatformAdapter } from './types.js'

export async function scanPlatforms(adapters: PlatformAdapter[]) {
  return Promise.all(adapters.map((adapter) => adapter.scan()))
}

export { createAdapterRegistry } from './registry.js'
export type { AdapterRegistry } from './registry.js'
export * from './rules/store.js'
