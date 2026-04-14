import type { PlatformAdapter } from './types.js'

export type { PlatformAdapter } from './types.js'
export type { ImportedSkill } from '@prism/shared'

export async function scanPlatforms(adapters: PlatformAdapter[]) {
  return Promise.all(adapters.map((adapter) => adapter.scan()))
}

export { createAdapterRegistry } from './registry.js'
export type { AdapterRegistry } from './registry.js'
export * from './rules/store.js'
export * from './rules/project.js'
export * from './profiles/store.js'
export * from './publish/platform-paths.js'
export * from './publish/engine.js'
export * from './publish/revision-store.js'
export * from './skills/store.js'
export * from './skills/parse.js'
export * from './agents/store.js'
