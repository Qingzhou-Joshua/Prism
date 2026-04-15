import type { FastifyInstance } from 'fastify'
import type { SkillStore } from '@prism/core'
import { getPlatformSkillsDir, skillFileName } from '@prism/core'
import type { CreateSkillDto, UpdateSkillDto, PlatformId } from '@prism/shared'

const ALL_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy']

const createSkillSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'content', 'tags', 'targetPlatforms'],
    properties: {
      name:              { type: 'string', minLength: 1 },
      description:       { type: 'string' },
      content:           { type: 'string' },
      trigger:           { type: 'string' },
      category:          { type: 'string' },
      arguments:         { type: 'array', items: { type: 'string' } },
      platformOverrides: { type: 'object' },
      tags:              { type: 'array', items: { type: 'string' } },
      targetPlatforms:   { type: 'array', items: { type: 'string' } },
    },
  },
}

const updateSkillSchema = {
  body: {
    type: 'object' as const,
    properties: {
      name:              { type: 'string', minLength: 1 },
      description:       { type: 'string' },
      content:           { type: 'string' },
      trigger:           { type: 'string' },
      category:          { type: 'string' },
      arguments:         { type: 'array', items: { type: 'string' } },
      platformOverrides: { type: 'object' },
      tags:              { type: 'array', items: { type: 'string' } },
      targetPlatforms:   { type: 'array', items: { type: 'string' } },
    },
  },
}

export async function registerSkillsRoutes(
  app: FastifyInstance,
  stores: Map<string, SkillStore>,
): Promise<void> {
  function getStore(platform: unknown): SkillStore {
    const id = typeof platform === 'string' ? platform : 'claude-code'
    return stores.get(id) ?? stores.get('claude-code')!
  }

  // GET /skills
  app.get<{ Querystring: { platform?: string } }>('/skills', async (request) => {
    const items = await getStore(request.query.platform).list()
    return { items }
  })

  // POST /skills
  app.post<{ Body: CreateSkillDto; Querystring: { platform?: string } }>('/skills', { schema: createSkillSchema }, async (request, reply) => {
    const skill = await getStore(request.query.platform).create(request.body)
    reply.code(201)
    return skill
  })

  // GET /skills/:id
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>('/skills/:id', async (request, reply) => {
    const skill = await getStore(request.query.platform).get(request.params.id)
    if (!skill) {
      reply.code(404)
      return { error: 'Skill not found' }
    }
    return skill
  })

  // PUT /skills/:id
  app.put<{ Params: { id: string }; Body: UpdateSkillDto; Querystring: { platform?: string } }>(
    '/skills/:id',
    { schema: updateSkillSchema },
    async (request, reply) => {
      const skill = await getStore(request.query.platform).update(request.params.id, request.body)
      if (!skill) {
        reply.code(404)
        return { error: 'Skill not found' }
      }
      return skill
    },
  )

  // DELETE /skills/:id
  app.delete<{ Params: { id: string }; Querystring: { platform?: string } }>('/skills/:id', async (request, reply) => {
    const deleted = await getStore(request.query.platform).delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Skill not found' }
    }
    reply.code(204)
    return null
  })

  // GET /skills/:id/projections
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>(
    '/skills/:id/projections',
    async (request, reply) => {
      const skill = await getStore(request.query.platform).get(request.params.id)
      if (!skill) {
        reply.code(404)
        return { error: 'Skill not found' }
      }

      // Only include platforms that support skills (getPlatformSkillsDir won't throw)
      const projections: Array<{ platformId: string; fileName: string; content: string }> = []
      for (const platformId of ALL_PLATFORM_IDS) {
        try {
          getPlatformSkillsDir(platformId)
          projections.push({
            platformId,
            fileName: skillFileName(skill.name),
            content: skill.content,
          })
        } catch {
          // Platform does not support skills — skip
        }
      }

      return { projections }
    },
  )
}
