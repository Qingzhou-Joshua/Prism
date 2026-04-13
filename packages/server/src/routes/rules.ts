import type { FastifyInstance } from 'fastify'
import type { RuleStore } from '@prism/core'
import { projectRule } from '@prism/core'
import type { CreateRuleDto, UpdateRuleDto } from '@prism/shared'
import type { PlatformId } from '@prism/shared'

const ALL_PLATFORM_IDS: PlatformId[] = ['openclaw', 'claude-code', 'cursor', 'codebuddy']

export async function registerRulesRoutes(
  app: FastifyInstance,
  store: RuleStore,
): Promise<void> {
  // GET /rules
  app.get('/rules', async () => {
    const items = await store.list()
    return { items }
  })

  // POST /rules
  app.post<{ Body: CreateRuleDto }>('/rules', async (request, reply) => {
    const rule = await store.create(request.body)
    reply.code(201)
    return rule
  })

  // GET /rules/:id
  app.get<{ Params: { id: string } }>('/rules/:id', async (request, reply) => {
    const rule = await store.get(request.params.id)
    if (!rule) {
      reply.code(404)
      return { error: 'Rule not found' }
    }
    return rule
  })

  // PUT /rules/:id
  app.put<{ Params: { id: string }; Body: UpdateRuleDto }>(
    '/rules/:id',
    async (request, reply) => {
      try {
        const rule = await store.update(request.params.id, request.body)
        return rule
      } catch {
        reply.code(404)
        return { error: 'Rule not found' }
      }
    },
  )

  // DELETE /rules/:id
  app.delete<{ Params: { id: string } }>('/rules/:id', async (request, reply) => {
    const deleted = await store.delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Rule not found' }
    }
    reply.code(204)
    return null
  })

  // GET /rules/:id/projections
  app.get<{ Params: { id: string } }>(
    '/rules/:id/projections',
    async (request, reply) => {
      const rule = await store.get(request.params.id)
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
