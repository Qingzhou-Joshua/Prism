import type { FastifyInstance } from 'fastify'
import type { AdapterRegistry } from '@prism/core'
import type { PlatformId, ImportableRule, ImportedSkill } from '@prism/shared'

/** Convert a fileName like "common-coding-style.md" → "common coding style" */
function fileNameToRuleName(fileName: string): string {
  return fileName.replace(/\.md$/i, '').replace(/-/g, ' ')
}

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

      const imported = await adapter.importRules()
      const items: ImportableRule[] = imported.map((r) => ({
        name: fileNameToRuleName(r.fileName),
        content: r.content,
        fileName: r.fileName,
      }))
      return { platformId, items }
    },
  )

  app.get<{ Params: { id: string } }>(
    '/platforms/:id/skills',
    async (request, reply) => {
      const platformId = request.params.id as PlatformId
      const adapter = registry.get(platformId)

      if (!adapter) {
        return reply.status(404).send({ error: `Platform '${platformId}' not found` })
      }

      if (!adapter.importSkills) {
        return reply.status(404).send({ error: `Platform '${platformId}' does not support skill import` })
      }

      const items: ImportedSkill[] = await adapter.importSkills()
      return { platformId, items }
    },
  )
}
