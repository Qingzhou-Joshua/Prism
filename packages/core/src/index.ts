import type { PlatformCapabilities, PlatformId, PlatformScanResult } from '@prism/shared'

export interface PlatformAdapter {
  id: PlatformId
  displayName: string
  capabilities: PlatformCapabilities
  scan: () => Promise<PlatformScanResult>
}

export async function scanPlatforms(adapters: PlatformAdapter[]) {
  return Promise.all(adapters.map((adapter) => adapter.scan()))
}
