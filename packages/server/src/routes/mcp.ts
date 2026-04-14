import type { FastifyInstance } from 'fastify'
import type { McpStore } from '@prism/core'
import type { AdapterRegistry } from '@prism/core'
import type { CreateMcpServerDto, UpdateMcpServerDto } from '@prism/shared'

const createMcpSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'command', 'args', 'targetPlatforms'],
    properties: {
      name:            { type: 'string', minLength: 1 },
      command:         { type: 'string', minLength: 1 },
      args:            { type: 'array', items: { type: 'string' } },
      env:             { type: 'object', additionalProperties: { type: 'string' } },
      description:     { type: 'string' },
      targetPlatforms: { type: 'array', items: { type: 'string' } },
    },
  },
}

const updateMcpSchema = {
  body: {
    type: 'object' as const,
    properties: {
      name:            { type: 'string', minLength: 1 },
      command:         { type: 'string', minLength: 1 },
      args:            { type: 'array', items: { type: 'string' } },
      env:             { type: 'object', additionalProperties: { type: 'string' } },
      description:     { type: 'string' },
      targetPlatforms: { type: 'array', items: { type: 'string' } },
    },
  },
}

export async function registerMcpRoutes(
  app: FastifyInstance,
  store: McpStore,
  registry?: AdapterRegistry,
): Promise<void> {
  // GET /mcp — list all
  app.get('/mcp', async () => {
    const items = await store.findAll()
    return { items }
  })

  // POST /mcp — create
  app.post<{ Body: CreateMcpServerDto }>('/mcp', { schema: createMcpSchema }, async (request, reply) => {
    const server = await store.create(request.body)
    reply.code(201)
    return server
  })

  // GET /mcp/:id
  app.get<{ Params: { id: string } }>('/mcp/:id', async (request, reply) => {
    const server = await store.findById(request.params.id)
    if (!server) {
      reply.code(404)
      return { error: 'MCP server not found' }
    }
    return server
  })

  // PUT /mcp/:id
  app.put<{ Params: { id: string }; Body: UpdateMcpServerDto }>(
    '/mcp/:id',
    { schema: updateMcpSchema },
    async (request, reply) => {
      const server = await store.update(request.params.id, request.body)
      if (!server) {
        reply.code(404)
        return { error: 'MCP server not found' }
      }
      return server
    },
  )

  // DELETE /mcp/:id
  app.delete<{ Params: { id: string } }>('/mcp/:id', async (request, reply) => {
    const deleted = await store.delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'MCP server not found' }
    }
    reply.code(204)
    return null
  })

  // GET /mcp/:id/projections
  app.get<{ Params: { id: string } }>('/mcp/:id/projections', async (request, reply) => {
    const server = await store.findById(request.params.id)
    if (!server) {
      reply.code(404)
      return { error: 'MCP server not found' }
    }
    // MCP projection: how this server would appear in a platform settings.json mcpServers block
    const projections: Array<{
      platformId: string
      key: string
      config: { command: string; args: string[]; env?: Record<string, string> }
    }> = []
    for (const platformId of server.targetPlatforms) {
      projections.push({
        platformId,
        key: server.name,
        config: {
          command: server.command,
          args: server.args,
          ...(server.env ? { env: server.env } : {}),
        },
      })
    }
    return { projections }
  })

  // POST /platforms/:platformId/mcp/import — import from platform config and persist
  app.post<{ Params: { platformId: string } }>(
    '/platforms/:platformId/mcp/import',
    async (request, reply) => {
      if (!registry) {
        reply.code(501)
        return { error: 'Registry not configured' }
      }
      const { platformId } = request.params
      const adapter = registry.get(platformId as Parameters<typeof registry.get>[0])
      const adapterAny = adapter as unknown as Record<string, unknown>
      if (!adapter || typeof adapterAny.importMcpServers !== 'function') {
        reply.code(404)
        return { error: 'Platform not found or does not support MCP import' }
      }
      try {
        const imported = await (adapterAny.importMcpServers as () => Promise<import('@prism/shared').ImportedMcpServer[]>)()
        await store.importServers(imported)
        const items = await store.findAll()
        return { imported: imported.length, items }
      } catch (err) {
        reply.code(500)
        return { error: err instanceof Error ? err.message : 'Import failed' }
      }
    },
  )

  // GET /platforms/:platformId/mcp/scan — read-only preview, no store mutation
  app.get<{ Params: { platformId: string } }>(
    '/platforms/:platformId/mcp/scan',
    async (request, reply) => {
      if (!registry) {
        reply.code(501)
        return { error: 'Registry not configured' }
      }
      const { platformId } = request.params
      const adapter = registry.get(platformId as Parameters<typeof registry.get>[0])
      const adapterAny = adapter as unknown as Record<string, unknown>
      if (!adapter || typeof adapterAny.importMcpServers !== 'function') {
        reply.code(404)
        return { error: 'Platform not found or does not support MCP import' }
      }
      try {
        const servers = await (adapterAny.importMcpServers as () => Promise<import('@prism/shared').ImportedMcpServer[]>)()
        return { servers }
      } catch (err) {
        reply.code(500)
        return { error: err instanceof Error ? err.message : 'Scan failed' }
      }
    },
  )
}
