import type { FastifyInstance } from 'fastify'
import type { AgentStore } from '@prism/core'
import { getPlatformAgentsDir, agentFileName } from '@prism/core'
import type { CreateAgentDto, UpdateAgentDto, PlatformId } from '@prism/shared'

const ALL_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy']

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
  stores: Map<string, AgentStore>,
): Promise<void> {
  function getStore(platform: unknown): AgentStore {
    const id = typeof platform === 'string' ? platform : 'claude-code'
    return stores.get(id) ?? stores.get('claude-code')!
  }

  // GET /agents
  app.get<{ Querystring: { platform?: string } }>('/agents', async (request) => {
    const items = await getStore(request.query.platform).list()
    return { items }
  })

  // POST /agents
  app.post<{ Body: CreateAgentDto; Querystring: { platform?: string } }>('/agents', { schema: createAgentSchema }, async (request, reply) => {
    const agent = await getStore(request.query.platform).create(request.body)
    reply.code(201)
    return agent
  })

  // GET /agents/:id
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>('/agents/:id', async (request, reply) => {
    const agent = await getStore(request.query.platform).get(request.params.id)
    if (!agent) {
      reply.code(404)
      return { error: 'Agent not found' }
    }
    return agent
  })

  // PUT /agents/:id
  app.put<{ Params: { id: string }; Body: UpdateAgentDto; Querystring: { platform?: string } }>(
    '/agents/:id',
    { schema: updateAgentSchema },
    async (request, reply) => {
      const agent = await getStore(request.query.platform).update(request.params.id, request.body)
      if (!agent) {
        reply.code(404)
        return { error: 'Agent not found' }
      }
      return agent
    },
  )

  // DELETE /agents/:id
  app.delete<{ Params: { id: string }; Querystring: { platform?: string } }>('/agents/:id', async (request, reply) => {
    const deleted = await getStore(request.query.platform).delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Agent not found' }
    }
    reply.code(204)
    return null
  })

  // GET /agents/:id/projections
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>(
    '/agents/:id/projections',
    async (request, reply) => {
      const agent = await getStore(request.query.platform).get(request.params.id)
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
