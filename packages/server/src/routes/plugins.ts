import type { FastifyInstance } from 'fastify'
import type { PluginStore } from '@prism/core'
import { pluginContents, readPluginAssetFile, scanPluginAssets } from '@prism/core'
import { PLUGIN_ASSET_TYPES } from '@prism/shared'
import type { AssetSummary, PluginAssetGroup, PluginAssetType, PluginContents } from '@prism/shared'
import { pickStore, resolvePlatformId } from './platform-store.js'

/** Counts of the user's own (non-plugin) assets on a platform. */
export type OwnAssetCounter = (platformId: string) => Promise<AssetSummary['own']>

const toggleSchema = {
  body: {
    type: 'object' as const,
    required: ['id', 'enabled'],
    properties: {
      id:      { type: 'string', minLength: 1 },
      enabled: { type: 'boolean' },
    },
  },
}

export async function registerPluginsRoutes(
  app: FastifyInstance,
  stores: Map<string, PluginStore>,
  countOwnAssets: OwnAssetCounter,
): Promise<void> {
  // GET /plugins?platform= — each plugin includes its asset composition
  app.get<{ Querystring: { platform?: string } }>('/plugins', async (request) => {
    const plugins = await pickStore(stores, request.query.platform).list()
    const items = await Promise.all(plugins.map(async p => ({ ...p, contents: await pluginContents(p) })))
    return { items }
  })

  // GET /plugin-assets?platform=&type=skills — read-only assets grouped by plugin
  app.get<{ Querystring: { platform?: string; type?: string } }>('/plugin-assets', async (request, reply) => {
    const type = request.query.type as PluginAssetType
    if (!PLUGIN_ASSET_TYPES.includes(type)) {
      reply.code(400)
      return { error: `type must be one of ${PLUGIN_ASSET_TYPES.join(', ')}` }
    }
    const plugins = await pickStore(stores, request.query.platform).list()
    const groups: PluginAssetGroup[] = (await Promise.all(
      plugins.map(async plugin => ({ plugin, items: await scanPluginAssets(plugin, type) })),
    )).filter(g => g.items.length > 0)
    return { groups }
  })

  // GET /plugin-assets/content?platform=&path= — file body for the read-only viewer
  app.get<{ Querystring: { platform?: string; path?: string } }>('/plugin-assets/content', async (request, reply) => {
    const plugins = await pickStore(stores, request.query.platform).list()
    const content = request.query.path ? await readPluginAssetFile(plugins, request.query.path) : null
    if (content === null) {
      reply.code(404)
      return { error: 'Not a plugin asset file on this platform' }
    }
    return { content }
  })

  // GET /assets/summary?platform= — own vs enabled-plugin asset counts (sidebar badges)
  app.get<{ Querystring: { platform?: string } }>('/assets/summary', async (request) => {
    const platformId = resolvePlatformId(request.query.platform)
    const store = stores.get(platformId)
    const plugins: PluginContents = {}
    if (store) {
      for (const p of (await store.list()).filter(p => p.enabled)) {
        for (const [type, n] of Object.entries(await pluginContents(p)) as [PluginAssetType, number][]) {
          plugins[type] = (plugins[type] ?? 0) + n
        }
      }
    }
    const summary: AssetSummary = { own: await countOwnAssets(platformId), plugins }
    return summary
  })

  // PUT /plugins/enabled?platform= — body { id, enabled }
  // (id goes in the body because plugin ids contain '@' and '/')
  app.put<{ Querystring: { platform?: string }; Body: { id: string; enabled: boolean } }>(
    '/plugins/enabled',
    { schema: toggleSchema },
    async (request, reply) => {
      const store = pickStore(stores, request.query.platform)
      try {
        const plugin = await store.setEnabled(request.body.id, request.body.enabled)
        if (!plugin) {
          reply.code(404)
          return { error: 'Plugin not found' }
        }
        return plugin
      } catch (err) {
        reply.code(400)
        return { error: err instanceof Error ? err.message : 'Toggle failed' }
      }
    },
  )
}
