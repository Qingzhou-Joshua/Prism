import type { FastifyInstance } from 'fastify'
import type { PublishEngine, FileRevisionStore } from '@prism/core'

export async function registerPublishRoutes(
  app: FastifyInstance,
  publishEngine: PublishEngine,
  revisionStore: FileRevisionStore,
): Promise<void> {
  // POST /profiles/:id/publish
  app.post<{ Params: { id: string } }>(
    '/profiles/:id/publish',
    async (request, reply) => {
      try {
        const revision = await publishEngine.publish(request.params.id)
        await revisionStore.save(revision)
        reply.code(201)
        return { revision }
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
