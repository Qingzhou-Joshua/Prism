import type { FastifyInstance } from 'fastify'
import type { HookStore } from '@prism/core'
import type { CreateHookDto, UpdateHookDto } from '@prism/shared'

const createHookSchema = {
  body: {
    type: 'object' as const,
    required: ['eventType', 'matcher', 'actions'],
    properties: {
      eventType:   { type: 'string' },
      matcher:     { type: 'string', minLength: 1 },
      description: { type: 'string' },
      actions:     { type: 'array' },
    },
  },
}

const updateHookSchema = {
  body: {
    type: 'object' as const,
    properties: {
      eventType:   { type: 'string' },
      matcher:     { type: 'string', minLength: 1 },
      description: { type: 'string' },
      actions:     { type: 'array' },
    },
  },
}

export async function registerHooksRoutes(
  app: FastifyInstance,
  stores: Map<string, HookStore>,
): Promise<void> {
  // GET /hooks?platform=<id>
  app.get<{ Querystring: { platform?: string } }>('/hooks', async (request, reply) => {
    if (!request.query.platform) {
      reply.code(400)
      return { error: 'platform query param required' }
    }
    const store = stores.get(request.query.platform)
    if (!store) {
      reply.code(404)
      return { error: `Platform '${request.query.platform}' not found` }
    }
    const items = await store.list()
    return { items }
  })

  // POST /hooks?platform=<id>
  app.post<{ Querystring: { platform?: string }; Body: CreateHookDto }>(
    '/hooks',
    { schema: createHookSchema },
    async (request, reply) => {
      if (!request.query.platform) {
        reply.code(400)
        return { error: 'platform query param required' }
      }
      const store = stores.get(request.query.platform)
      if (!store) {
        reply.code(404)
        return { error: `Platform '${request.query.platform}' not found` }
      }
      const hook = await store.create(request.body)
      reply.code(201)
      return hook
    },
  )

  // GET /hooks/:id?platform=<id>
  app.get<{ Params: { id: string }; Querystring: { platform?: string } }>(
    '/hooks/:id',
    async (request, reply) => {
      if (!request.query.platform) {
        reply.code(400)
        return { error: 'platform query param required' }
      }
      const store = stores.get(request.query.platform)
      if (!store) {
        reply.code(404)
        return { error: `Platform '${request.query.platform}' not found` }
      }
      const hook = await store.get(request.params.id)
      if (!hook) {
        reply.code(404)
        return { error: 'Hook not found' }
      }
      return hook
    },
  )

  // PUT /hooks/:id?platform=<id>
  app.put<{ Params: { id: string }; Querystring: { platform?: string }; Body: UpdateHookDto }>(
    '/hooks/:id',
    { schema: updateHookSchema },
    async (request, reply) => {
      if (!request.query.platform) {
        reply.code(400)
        return { error: 'platform query param required' }
      }
      const store = stores.get(request.query.platform)
      if (!store) {
        reply.code(404)
        return { error: `Platform '${request.query.platform}' not found` }
      }
      const hook = await store.update(request.params.id, request.body)
      if (!hook) {
        reply.code(404)
        return { error: 'Hook not found' }
      }
      return hook
    },
  )

  // DELETE /hooks/:id?platform=<id>
  app.delete<{ Params: { id: string }; Querystring: { platform?: string } }>(
    '/hooks/:id',
    async (request, reply) => {
      if (!request.query.platform) {
        reply.code(400)
        return { error: 'platform query param required' }
      }
      const store = stores.get(request.query.platform)
      if (!store) {
        reply.code(404)
        return { error: `Platform '${request.query.platform}' not found` }
      }
      const deleted = await store.delete(request.params.id)
      if (!deleted) {
        reply.code(404)
        return { error: 'Hook not found' }
      }
      reply.code(204)
      return null
    },
  )
}
