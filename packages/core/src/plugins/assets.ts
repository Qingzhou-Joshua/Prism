import { readFile, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import type { PluginAssetItem, PluginAssetType, PluginContents, PluginInfo, PlatformId } from '@prism/shared'
import { PLUGIN_ASSET_TYPES } from '@prism/shared'
import { DirSkillStore } from '../skills/dir-store.js'
import { DirAgentStore } from '../agents/dir-store.js'
import { DirCommandStore } from '../commands/dir-store.js'
import { FileHookStore } from '../hooks/store.js'

// ── Plugin asset scanning ───────────────────────────────────────────────────
//
// Plugins ship assets in conventional sub-paths of their install dir
// (skills/<name>/SKILL.md, agents/*.md, commands/*.md, hooks/hooks.json,
// .mcp.json). These are read-only to Prism: the plugin manager owns them and
// would overwrite edits on update.

type Raw = Record<string, unknown>

const CACHE_TTL_MS = 10_000
const cache = new Map<string, { at: number; mtime: number; items: PluginAssetItem[] }>()

async function mtimeOf(path: string): Promise<number> {
  try {
    return (await stat(path)).mtimeMs
  } catch {
    return 0
  }
}

async function scanUncached(installPath: string, type: PluginAssetType, platformId: PlatformId): Promise<PluginAssetItem[]> {
  switch (type) {
    case 'skills':
      return (await new DirSkillStore(join(installPath, 'skills')).list()).map(s => ({
        id: s.filePath ?? s.id, name: s.name, description: s.description, filePath: s.filePath,
      }))
    case 'agents':
      return (await new DirAgentStore(join(installPath, 'agents')).list()).map(a => ({
        id: a.filePath ?? a.id, name: a.name, description: a.description, filePath: a.filePath,
      }))
    case 'commands':
      return (await new DirCommandStore(join(installPath, 'commands')).list()).map(c => ({
        id: c.filePath ?? c.id, name: c.name, description: c.description, filePath: c.filePath,
      }))
    case 'hooks': {
      const path = join(installPath, 'hooks', 'hooks.json')
      const hooks = await new FileHookStore(path, platformId).list().catch(() => [])
      return hooks.map(h => {
        const cmd = h.actions.map(a => ('command' in a && a.command) || ('prompt' in a && a.prompt) || '').filter(Boolean).join(' && ')
        return {
          id: h.id,
          name: h.matcher && h.matcher !== '.*' && h.matcher !== '*' ? `${h.eventType} · ${h.matcher}` : h.eventType,
          description: h.description,
          detail: cmd || undefined,
          filePath: path,
        }
      })
    }
    case 'mcp': {
      const path = join(installPath, '.mcp.json')
      let doc: Raw
      try {
        doc = JSON.parse(await readFile(path, 'utf-8')) as Raw
      } catch {
        return []
      }
      // Either { mcpServers: {...} } or a bare name → config map
      const servers = (doc.mcpServers && typeof doc.mcpServers === 'object' ? doc.mcpServers : doc) as Record<string, Raw>
      return Object.entries(servers)
        .filter(([, cfg]) => cfg && typeof cfg === 'object' && ('command' in cfg || 'url' in cfg))
        .map(([name, cfg]) => ({
          id: `${path}#${name}`,
          name,
          detail: typeof cfg.url === 'string'
            ? cfg.url
            : [cfg.command, ...(Array.isArray(cfg.args) ? cfg.args : [])].map(String).join(' '),
          filePath: path,
        }))
    }
  }
}

/** Assets of one type contributed by a plugin (empty when it has no install dir). */
export async function scanPluginAssets(plugin: PluginInfo, type: PluginAssetType): Promise<PluginAssetItem[]> {
  if (!plugin.installPath) return []
  const key = `${plugin.installPath}|${type}`
  const mtime = await mtimeOf(plugin.installPath)
  const hit = cache.get(key)
  if (hit && hit.mtime === mtime && Date.now() - hit.at < CACHE_TTL_MS) return hit.items
  const items = await scanUncached(plugin.installPath, type, plugin.platformId)
  cache.set(key, { at: Date.now(), mtime, items })
  return items
}

export async function pluginContents(plugin: PluginInfo): Promise<PluginContents> {
  const counts = await Promise.all(PLUGIN_ASSET_TYPES.map(async t => [t, (await scanPluginAssets(plugin, t)).length] as const))
  return Object.fromEntries(counts.filter(([, n]) => n > 0))
}

/**
 * Read a plugin asset file for the read-only viewer. Only paths inside one of
 * the given plugins' install dirs are allowed.
 */
export async function readPluginAssetFile(plugins: PluginInfo[], filePath: string): Promise<string | null> {
  const target = resolve(filePath)
  const allowed = plugins.some(p => p.installPath && target.startsWith(resolve(p.installPath) + sep))
  if (!allowed) return null
  try {
    return await readFile(target, 'utf-8')
  } catch {
    return null
  }
}
