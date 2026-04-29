import type { FastifyInstance } from 'fastify'
import type { CommandStore } from '@prism/core'
import { getPlatformCommandsDir, commandFileName } from '@prism/core'
import type { CreateCommandDto, UpdateCommandDto, PlatformId } from '@prism/shared'

const ALL_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy', 'openclaw']

const createCommandSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'content', 'tags', 'targetPlatforms'],
    properties: {
      name:            { type: 'string', minLength: 1 },
      description:     { type: 'string' },
      content:         { type: 'string' },
      tags:            { type: 'array', items: { type: 'string' } },
      targetPlatforms: { type: 'array', items: { type: 'string' } },
    },
  },
}

const updateCommandSchema = {
  body: {
    type: 'object' as const,
    properties: {
      name:            { type: 'string', minLength: 1 },
      description:     { type: 'string' },
      content:         { type: 'string' },
      tags:            { type: 'array', items: { type: 'string' } },
      targetPlatforms: { type: 'array', items: { type: 'string' } },
    },
  },
}

export async function registerCommandsRoutes(
  app: FastifyInstance,
  stores: Map<string, CommandStore>,
): Promise<void> {
  function getStore(platform: unknown): CommandStore {
    const id = typeof platform === 'string' ? platform : 'claude-code'
    return stores.get(id) ?? stores.get('claude-code')!
  }

  // GET /commands
  app.get<{ Querystring: { platform?: string } }>('/commands', async (request) => {
    const items = await getStore(request.query.platform).list()
    return { items }
  })

  // POST /commands
  app.post<{ Body: CreateCommandDto; Querystring: { platform?: string } }>('/commands', { schema: createCommandSchema }, async (request, reply) => {
    const command = await getStore(request.query.platform).create(request.body)
    reply.code(201)
    return command
  })

  // GET /commands/:id
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>('/commands/:id', async (request, reply) => {
    const command = await getStore(request.query.platform).get(request.params.id)
    if (!command) {
      reply.code(404)
      return { error: 'Command not found' }
    }
    return command
  })

  // PUT /commands/:id
  app.put<{ Params: { id: string }; Body: UpdateCommandDto; Querystring: { platform?: string } }>(
    '/commands/:id',
    { schema: updateCommandSchema },
    async (request, reply) => {
      const command = await getStore(request.query.platform).update(request.params.id, request.body)
      if (!command) {
        reply.code(404)
        return { error: 'Command not found' }
      }
      return command
    },
  )

  // DELETE /commands/:id
  app.delete<{ Params: { id: string }; Querystring: { platform?: string } }>('/commands/:id', async (request, reply) => {
    const deleted = await getStore(request.query.platform).delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Command not found' }
    }
    reply.code(204)
    return null
  })

  // GET /commands/:id/projections
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>(
    '/commands/:id/projections',
    async (request, reply) => {
      const command = await getStore(request.query.platform).get(request.params.id)
      if (!command) {
        reply.code(404)
        return { error: 'Command not found' }
      }

      const projections: Array<{ platformId: string; fileName: string; content: string }> = []
      // Filter to only the platforms this command targets (empty = all platforms)
      const targetIds = command.targetPlatforms.length > 0
        ? ALL_PLATFORM_IDS.filter(id => command.targetPlatforms.includes(id))
        : ALL_PLATFORM_IDS
      for (const platformId of targetIds) {
        projections.push({
          platformId,
          fileName: commandFileName(command.name),
          content: command.content,
        })
      }

      return { projections }
    },
  )
}
