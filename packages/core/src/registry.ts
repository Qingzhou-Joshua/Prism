import type { PlatformAdapter } from './types.js'
import type { PlatformId, PlatformScanResult } from '@prism/shared'

export interface AdapterRegistry {
  getAll: () => PlatformAdapter[]
  get: (id: PlatformId) => PlatformAdapter | undefined
  scanAll: () => Promise<PlatformScanResult[]>
}

export function createAdapterRegistry(adapters: PlatformAdapter[]): AdapterRegistry {
  const map = new Map<PlatformId, PlatformAdapter>(
    adapters.map((a) => [a.id, a]),
  )

  return {
    getAll: () => [...map.values()],
    get: (id) => map.get(id),
    scanAll: () => Promise.all([...map.values()].map((a) => a.scan())),
  }
}
