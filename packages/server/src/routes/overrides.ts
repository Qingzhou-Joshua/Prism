import type { FastifyInstance } from 'fastify'
import type { OverrideStore } from '@prism/core'
import type { PlatformId, AssetType } from '@prism/shared'

const VALID_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy', 'openclaw']
const VALID_ASSET_TYPES: AssetType[] = ['rule', 'skill', 'agent', 'mcp', 'hook']

interface OverrideParams {
  platformId: string
  assetType: string
  id: string
}

interface ListParams {
  platformId: string
  assetType: string
}

interface OverrideBody {
  content: string
}

function validatePlatformId(
  platformId: string,
): { valid: true; value: PlatformId } | { valid: false } {
  if (VALID_PLATFORM_IDS.includes(platformId as PlatformId)) {
    return { valid: true, value: platformId as PlatformId }
  }
  return { valid: false }
}

function validateAssetType(
  assetType: string,
): { valid: true; value: AssetType } | { valid: false } {
  if (VALID_ASSET_TYPES.includes(assetType as AssetType)) {
    return { valid: true, value: assetType as AssetType }
  }
  return { valid: false }
}

export async function registerOverridesRoutes(
  app: FastifyInstance,
  store: OverrideStore,
): Promise<void> {
  // GET /overrides/:platformId/:assetType/:id
  app.get<{ Params: OverrideParams }>('/overrides/:platformId/:assetType/:id', async (request, reply) => {
    const platformResult = validatePlatformId(request.params.platformId)
    if (!platformResult.valid) {
      reply.code(400)
      return { error: 'Invalid platformId' }
    }
    const assetResult = validateAssetType(request.params.assetType)
    if (!assetResult.valid) {
      reply.code(400)
      return { error: 'Invalid assetType' }
    }

    const content = await store.get(platformResult.value, assetResult.value, request.params.id)
    if (content === null) {
      reply.code(404)
      return { error: 'Override not found' }
    }
    return { content }
  })

  // PUT /overrides/:platformId/:assetType/:id
  app.put<{ Params: OverrideParams; Body: OverrideBody }>(
    '/overrides/:platformId/:assetType/:id',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['content'],
          properties: { content: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const platformResult = validatePlatformId(request.params.platformId)
      if (!platformResult.valid) {
        reply.code(400)
        return { error: 'Invalid platformId' }
      }
      const assetResult = validateAssetType(request.params.assetType)
      if (!assetResult.valid) {
        reply.code(400)
        return { error: 'Invalid assetType' }
      }

      await store.set(platformResult.value, assetResult.value, request.params.id, request.body.content)
      return { content: request.body.content }
    },
  )

  // DELETE /overrides/:platformId/:assetType/:id
  app.delete<{ Params: OverrideParams }>(
    '/overrides/:platformId/:assetType/:id',
    async (request, reply) => {
      const platformResult = validatePlatformId(request.params.platformId)
      if (!platformResult.valid) {
        reply.code(400)
        return { error: 'Invalid platformId' }
      }
      const assetResult = validateAssetType(request.params.assetType)
      if (!assetResult.valid) {
        reply.code(400)
        return { error: 'Invalid assetType' }
      }

      const deleted = await store.delete(platformResult.value, assetResult.value, request.params.id)
      if (!deleted) {
        reply.code(404)
        return { error: 'Override not found' }
      }
      reply.code(204)
      return null
    },
  )

  // GET /overrides/:platformId/:assetType
  app.get<{ Params: ListParams }>('/overrides/:platformId/:assetType', async (request, reply) => {
    const platformResult = validatePlatformId(request.params.platformId)
    if (!platformResult.valid) {
      reply.code(400)
      return { error: 'Invalid platformId' }
    }
    const assetResult = validateAssetType(request.params.assetType)
    if (!assetResult.valid) {
      reply.code(400)
      return { error: 'Invalid assetType' }
    }

    const items = await store.listForPlatform(platformResult.value, assetResult.value)
    return { items }
  })
}
