import type { FastifyInstance } from 'fastify'
import type { RegistryStore } from '@prism/core'

export async function registerRegistryRoutes(
  app: FastifyInstance,
  store: RegistryStore,
): Promise<void> {
  // GET /registry → { entries: RegistryEntry[], lastUpdated: string }
  app.get('/registry', async () => {
    const registry = await store.load()
    return { entries: registry.entries, lastUpdated: registry.lastUpdated }
  })

  // GET /registry/conflicts → { conflicts: ConflictGroup[] }
  app.get('/registry/conflicts', async () => {
    const conflicts = await store.getConflicts()
    return { conflicts }
  })

  // DELETE /registry → reset (dev/testing only — clears all indexed entries)
  app.delete('/registry', async (_, reply) => {
    await store.reset()
    reply.code(204)
    return null
  })
}
