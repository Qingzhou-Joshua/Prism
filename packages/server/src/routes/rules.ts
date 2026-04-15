import type { FastifyInstance } from 'fastify'
import type { RuleStore } from '@prism/core'
import { projectRule } from '@prism/core'
import type { CreateRuleDto, UpdateRuleDto } from '@prism/shared'
import type { PlatformId } from '@prism/shared'

const ALL_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy']

const createRuleSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'content', 'scope'],
    properties: {
      name:              { type: 'string', minLength: 1 },
      content:           { type: 'string' },
      scope:             { type: 'string', enum: ['global', 'project'] },
      tags:              { type: 'array', items: { type: 'string' } },
      platformOverrides: { type: 'object' },
    },
  },
}

const updateRuleSchema = {
  body: {
    type: 'object' as const,
    properties: {
      name:              { type: 'string', minLength: 1 },
      content:           { type: 'string' },
      scope:             { type: 'string', enum: ['global', 'project'] },
      tags:              { type: 'array', items: { type: 'string' } },
      platformOverrides: { type: 'object' },
    },
  },
}

export async function registerRulesRoutes(
  app: FastifyInstance,
  stores: Map<string, RuleStore>,
): Promise<void> {
  function getStore(platform: unknown): RuleStore {
    const id = typeof platform === 'string' ? platform : 'claude-code'
    return stores.get(id) ?? stores.get('claude-code')!
  }

  // GET /rules
  app.get<{ Querystring: { platform?: string } }>('/rules', async (request) => {
    const items = await getStore(request.query.platform).list()
    return { items }
  })

  // POST /rules
  app.post<{ Body: CreateRuleDto; Querystring: { platform?: string } }>('/rules', { schema: createRuleSchema }, async (request, reply) => {
    const rule = await getStore(request.query.platform).create(request.body)
    reply.code(201)
    return rule
  })

  // GET /rules/:id
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>('/rules/:id', async (request, reply) => {
    const rule = await getStore(request.query.platform).get(request.params.id)
    if (!rule) {
      reply.code(404)
      return { error: 'Rule not found' }
    }
    return rule
  })

  // PUT /rules/:id
  app.put<{ Params: { id: string }; Body: UpdateRuleDto; Querystring: { platform?: string } }>(
    '/rules/:id',
    { schema: updateRuleSchema },
    async (request, reply) => {
      const rule = await getStore(request.query.platform).update(request.params.id, request.body)
      if (!rule) {
        reply.code(404)
        return { error: 'Rule not found' }
      }
      return rule
    },
  )

  // DELETE /rules/:id
  app.delete<{ Params: { id: string }; Querystring: { platform?: string } }>('/rules/:id', async (request, reply) => {
    const deleted = await getStore(request.query.platform).delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Rule not found' }
    }
    reply.code(204)
    return null
  })

  // GET /rules/:id/projections
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>(
    '/rules/:id/projections',
    async (request, reply) => {
      const rule = await getStore(request.query.platform).get(request.params.id)
      if (!rule) {
        reply.code(404)
        return { error: 'Rule not found' }
      }
      const projections = ALL_PLATFORM_IDS.map((platformId) =>
        projectRule(rule, platformId),
      )
      return { projections }
    },
  )
}
