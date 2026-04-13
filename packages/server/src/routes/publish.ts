import type { FastifyInstance } from 'fastify'
import type { PublishEngine, FileRevisionStore } from '@prism/core'
import { NotFoundError } from '@prism/shared'

export async function registerPublishRoutes(
  app: FastifyInstance,
  publishEngine: PublishEngine,
  revisionStore: FileRevisionStore,
): Promise<void> {
  // POST /profiles/:id/publish
  app.post<{ Params: { id: string } }>(
    '/profiles/:id/publish',
    async (request, reply) => {
      let revision
      try {
        revision = await publishEngine.publish(request.params.id)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: message })
        }
        return reply.code(500).send({ error: message })
      }

      try {
        await revisionStore.save(revision)
      } catch (saveError: unknown) {
        // Publish succeeded (files written), but revision record failed to save.
        // Log the error but still return 201 — returning 500 here would be misleading
        // since the files are already on disk.
        const message = saveError instanceof Error ? saveError.message : String(saveError)
        app.log.warn(`Failed to save revision ${revision.id}: ${message}`)
      }

      return reply.code(201).send({ revision })
    },
  )
}
