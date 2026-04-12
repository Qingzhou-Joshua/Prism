import type { FastifyInstance } from 'fastify'
import type { AdapterRegistry } from '@prism/core'
import type { PlatformId } from '@prism/shared'

interface ScanBody {
  platformId?: PlatformId
}

export function registerScanRoutes(
  app: FastifyInstance,
  registry: AdapterRegistry
) {
  // POST /scan — 重新扫描全部或单个平台
  app.post<{ Body: ScanBody }>('/scan', async (request, reply) => {
    const { platformId } = request.body ?? {}

    if (platformId) {
      const adapter = registry.get(platformId)
      if (!adapter) {
        reply.code(404)
        return { error: `Unknown platform: ${platformId}` }
      }
      try {
        const result = await adapter.scan()
        return { items: [result], scannedAt: new Date().toISOString() }
      } catch (err) {
        reply.code(500)
        return { error: 'Scan failed', detail: err instanceof Error ? err.message : String(err) }
      }
    }

    try {
      const items = await registry.scanAll()
      return { items, scannedAt: new Date().toISOString() }
    } catch (err) {
      reply.code(500)
      return { error: 'Scan failed', detail: err instanceof Error ? err.message : String(err) }
    }
  })
}
