import type { FastifyInstance } from 'fastify'
import type { AdapterRegistry } from '@prism/core'
import type { PlatformId } from '@prism/shared'

export async function registerPlatformRulesRoutes(
  app: FastifyInstance,
  registry: AdapterRegistry,
): Promise<void> {
  app.get<{ Params: { id: string } }>(
    '/platforms/:id/rules',
    async (request, reply) => {
      const platformId = request.params.id as PlatformId
      const adapter = registry.get(platformId)

      if (!adapter) {
        return reply.status(404).send({ error: `Platform '${platformId}' not found` })
      }

      if (!adapter.importRules) {
        return reply.status(404).send({ error: `Platform '${platformId}' does not support rule import` })
      }

      const rules = await adapter.importRules()
      return { platformId, items: rules }
    },
  )
}
