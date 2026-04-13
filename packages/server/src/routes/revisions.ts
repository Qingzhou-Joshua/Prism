import type { FastifyInstance } from 'fastify'
import type { FileRevisionStore } from '@prism/core'

export async function registerRevisionRoutes(
  app: FastifyInstance,
  revisionStore: FileRevisionStore,
): Promise<void> {
  // GET /revisions
  app.get('/revisions', async () => {
    const items = await revisionStore.listAll()
    return { items }
  })

  // GET /revisions/:id
  app.get<{ Params: { id: string } }>(
    '/revisions/:id',
    async (request, reply) => {
      const revision = await revisionStore.get(request.params.id)
      if (!revision) {
        reply.code(404)
        return { error: 'Revision not found' }
      }
      return revision
    },
  )

  // POST /revisions/:id/rollback
  app.post<{ Params: { id: string } }>(
    '/revisions/:id/rollback',
    async (request, reply) => {
      try {
        await revisionStore.rollback(request.params.id)
        return { ok: true }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        if (message.includes('not found')) {
          reply.code(404)
          return { error: message }
        }
        reply.code(500)
        return { error: message }
      }
    },
  )
}
