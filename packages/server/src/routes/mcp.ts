import type { FastifyInstance } from 'fastify'
import type { McpStore, AdapterRegistry } from '@prism/core'
import type { CreateMcpServerDto, UpdateMcpServerDto, ImportedMcpServer } from '@prism/shared'
import { pickStore } from './platform-store.js'

const serverProperties = {
  name:            { type: 'string', minLength: 1 },
  command:         { type: 'string' },
  args:            { type: 'array', items: { type: 'string' } },
  env:             { type: 'object', additionalProperties: { type: 'string' } },
  type:            { type: 'string', enum: ['stdio', 'http', 'sse'] },
  url:             { type: 'string' },
  headers:         { type: 'object', additionalProperties: { type: 'string' } },
  enabled:         { type: 'boolean' },
  description:     { type: 'string' },
  targetPlatforms: { type: 'array', items: { type: 'string' } },
}

const createMcpSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'args', 'targetPlatforms'],
    properties: serverProperties,
  },
}

const updateMcpSchema = {
  body: {
    type: 'object' as const,
    properties: serverProperties,
  },
}

type PlatformQuery = { Querystring: { platform?: string } }

/**
 * MCP servers live in each platform's own config file; `?platform=` selects
 * which one (defaults to the first discovered platform).
 */
export async function registerMcpRoutes(
  app: FastifyInstance,
  stores: Map<string, McpStore>,
  registry?: AdapterRegistry,
): Promise<void> {
  const getStore = (platform: unknown) => pickStore(stores, platform)

  app.get<PlatformQuery>('/mcp', async (request) => {
    const items = await getStore(request.query.platform).findAll()
    return { items }
  })

  app.post<PlatformQuery & { Body: CreateMcpServerDto }>('/mcp', { schema: createMcpSchema }, async (request, reply) => {
    const body = request.body
    if (!body.command && !body.url) {
      reply.code(400)
      return { error: 'Either command (stdio) or url (http/sse) is required' }
    }
    const server = await getStore(request.query.platform).create({ ...body, command: body.command ?? '' })
    reply.code(201)
    return server
  })

  app.get<PlatformQuery & { Params: { id: string } }>('/mcp/:id', async (request, reply) => {
    const server = await getStore(request.query.platform).findById(request.params.id)
    if (!server) {
      reply.code(404)
      return { error: 'MCP server not found' }
    }
    return server
  })

  app.put<PlatformQuery & { Params: { id: string }; Body: UpdateMcpServerDto }>(
    '/mcp/:id',
    { schema: updateMcpSchema },
    async (request, reply) => {
      const server = await getStore(request.query.platform).update(request.params.id, request.body)
      if (!server) {
        reply.code(404)
        return { error: 'MCP server not found' }
      }
      return server
    },
  )

  app.delete<PlatformQuery & { Params: { id: string } }>('/mcp/:id', async (request, reply) => {
    const deleted = await getStore(request.query.platform).delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'MCP server not found' }
    }
    reply.code(204)
    return null
  })

  // GET /mcp/:id/projections — how this server would look on each other MCP-capable platform
  app.get<PlatformQuery & { Params: { id: string } }>('/mcp/:id/projections', async (request, reply) => {
    const server = await getStore(request.query.platform).findById(request.params.id)
    if (!server) {
      reply.code(404)
      return { error: 'MCP server not found' }
    }
    const projections = [...stores.keys()].map(platformId => ({
      platformId,
      key: server.name,
      config: server.url
        ? { type: server.type, url: server.url, ...(server.headers ? { headers: server.headers } : {}) }
        : { command: server.command, args: server.args, ...(server.env ? { env: server.env } : {}) },
    }))
    return { projections }
  })

  function getImporter(platformId: string): (() => Promise<ImportedMcpServer[]>) | null {
    const adapter = registry?.get(platformId)
    return adapter?.importMcpServers ? adapter.importMcpServers.bind(adapter) : null
  }

  // POST /platforms/:platformId/mcp/import?platform=<target> — copy servers from
  // one platform's config into the target platform's config
  app.post<PlatformQuery & { Params: { platformId: string } }>(
    '/platforms/:platformId/mcp/import',
    async (request, reply) => {
      const importer = getImporter(request.params.platformId)
      if (!importer) {
        reply.code(404)
        return { error: 'Platform not found or does not support MCP import' }
      }
      const target = getStore(request.query.platform)
      const imported = await importer()
      await target.importServers(imported)
      return { imported: imported.length, items: await target.findAll() }
    },
  )

  // GET /platforms/:platformId/mcp/scan — read-only preview
  app.get<{ Params: { platformId: string } }>(
    '/platforms/:platformId/mcp/scan',
    async (request, reply) => {
      const importer = getImporter(request.params.platformId)
      if (!importer) {
        reply.code(404)
        return { error: 'Platform not found or does not support MCP import' }
      }
      return { servers: await importer() }
    },
  )
}
