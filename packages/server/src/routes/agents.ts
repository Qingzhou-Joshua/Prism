import type { FastifyInstance } from 'fastify'
import type { AgentStore } from '@prism/core'
import { getPlatformAgentsDir, agentFileName } from '@prism/core'
import type { CreateAgentDto, UpdateAgentDto, PlatformId } from '@prism/shared'

const ALL_PLATFORM_IDS: PlatformId[] = ['openclaw', 'claude-code', 'cursor', 'codebuddy']

const createAgentSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'content', 'tags', 'targetPlatforms'],
    properties: {
      name:            { type: 'string', minLength: 1 },
      description:     { type: 'string' },
      content:         { type: 'string' },
      agentType:       { type: 'string' },
      tags:            { type: 'array', items: { type: 'string' } },
      targetPlatforms: { type: 'array', items: { type: 'string' } },
    },
  },
}

const updateAgentSchema = {
  body: {
    type: 'object' as const,
    properties: {
      name:            { type: 'string', minLength: 1 },
      description:     { type: 'string' },
      content:         { type: 'string' },
      agentType:       { type: 'string' },
      tags:            { type: 'array', items: { type: 'string' } },
      targetPlatforms: { type: 'array', items: { type: 'string' } },
    },
  },
}

export async function registerAgentsRoutes(
  app: FastifyInstance,
  store: AgentStore,
): Promise<void> {
  // GET /agents
  app.get('/agents', async () => {
    const items = await store.list()
    return { items }
  })

  // POST /agents
  app.post<{ Body: CreateAgentDto }>('/agents', { schema: createAgentSchema }, async (request, reply) => {
    const agent = await store.create(request.body)
    reply.code(201)
    return agent
  })

  // GET /agents/:id
  app.get<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agent = await store.get(request.params.id)
    if (!agent) {
      reply.code(404)
      return { error: 'Agent not found' }
    }
    return agent
  })

  // PUT /agents/:id
  app.put<{ Params: { id: string }; Body: UpdateAgentDto }>(
    '/agents/:id',
    { schema: updateAgentSchema },
    async (request, reply) => {
      const agent = await store.update(request.params.id, request.body)
      if (!agent) {
        reply.code(404)
        return { error: 'Agent not found' }
      }
      return agent
    },
  )

  // DELETE /agents/:id
  app.delete<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const deleted = await store.delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Agent not found' }
    }
    reply.code(204)
    return null
  })

  // GET /agents/:id/projections
  app.get<{ Params: { id: string } }>(
    '/agents/:id/projections',
    async (request, reply) => {
      const agent = await store.get(request.params.id)
      if (!agent) {
        reply.code(404)
        return { error: 'Agent not found' }
      }

      // Only include platforms that support agents (getPlatformAgentsDir returns non-null)
      const projections: Array<{ platformId: string; fileName: string; content: string }> = []
      for (const platformId of ALL_PLATFORM_IDS) {
        if (getPlatformAgentsDir(platformId) !== null) {
          projections.push({
            platformId,
            fileName: agentFileName(agent.name),
            content: agent.content,
          })
        }
      }

      return { projections }
    },
  )
}
