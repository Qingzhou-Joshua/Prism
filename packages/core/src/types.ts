import type { PlatformCapabilities, PlatformId, PlatformScanResult } from '@prism/shared'

export interface PlatformAdapter {
  id: PlatformId
  displayName: string
  capabilities: PlatformCapabilities
  scan: () => Promise<PlatformScanResult>
}
