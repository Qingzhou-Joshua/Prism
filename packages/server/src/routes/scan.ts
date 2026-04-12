import type { FastifyInstance } from 'fastify'
import type { AdapterRegistry } from '@prism/core'
import type { PlatformId } from '@prism/shared'

interface ScanBody {
  platformId?: PlatformId
}

export async function registerScanRoutes(
  app: FastifyInstance,
  registry: AdapterRegistry
) {
  // POST /scan — 重新扫描全部或单个平台
  app.post<{ Body: ScanBody }>('/scan', async (request) => {
    const { platformId } = request.body ?? {}

    if (platformId) {
      const adapter = registry.get(platformId)
      if (!adapter) {
        return { error: `Unknown platform: ${platformId}` }
      }
      const result = await adapter.scan()
      return { items: [result], scannedAt: new Date().toISOString() }
    }

    const items = await registry.scanAll()
    return { items, scannedAt: new Date().toISOString() }
  })
}
