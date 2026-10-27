import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PlatformId, PluginInfo } from '@prism/shared'
import type { PluginSourceSpec } from '../platforms/instances.js'
import { readJsonObject, readTextOrNull, setJsonPath, writeTextAtomic } from '../utils/config-file.js'
import { getTomlTable, readToml, replaceTomlTable } from '../utils/toml-edit.js'

// ── PluginStore ─────────────────────────────────────────────────────────────
//
// Lists plugins installed into a platform and toggles them where the platform
// has an explicit enable flag. Installation/removal stays with each tool's own
// CLI — Prism only flips the flag in the native config.

type Raw = Record<string, unknown>

/** Most recently modified sub-directory of `dir` (plugin caches keep one dir per version). */
async function latestVersionDir(dir: string): Promise<string | null> {
  const versions = await readdir(dir).catch(() => [] as string[])
  let latest: { v: string; t: number } | null = null
  for (const v of versions) {
    const s = await stat(join(dir, v)).catch(() => null)
    if (s?.isDirectory() && (!latest || s.mtimeMs > latest.t)) latest = { v, t: s.mtimeMs }
  }
  return latest ? join(dir, latest.v) : null
}

function splitId(id: string): { name: string; source?: string } {
  const at = id.lastIndexOf('@')
  return at > 0 ? { name: id.slice(0, at), source: id.slice(at + 1) } : { name: id }
}

export class PluginStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly spec: PluginSourceSpec,
    private readonly platformId: PlatformId,
  ) {}

  async list(): Promise<PluginInfo[]> {
    switch (this.spec.type) {
      case 'claude': return this.listClaude(this.spec)
      case 'codex': return this.listCodex(this.spec)
      case 'opencode': return this.listOpencode(this.spec)
      case 'cursor': return this.listCursor(this.spec)
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<PluginInfo | null> {
    const run = async (): Promise<PluginInfo | null> => {
      const existing = (await this.list()).find(p => p.id === id)
      if (!existing) return null
      if (!existing.toggleable) throw new Error(`Plugin "${id}" cannot be toggled on ${this.platformId}`)
      if (this.spec.type === 'claude') {
        await setJsonPath(this.spec.settingsPath, ['enabledPlugins', id], enabled)
      } else if (this.spec.type === 'codex') {
        const text = (await readTextOrNull(this.spec.configPath)) ?? ''
        const path = ['plugins', id]
        const table = getTomlTable(readToml(text), path) ?? {}
        await writeTextAtomic(this.spec.configPath, replaceTomlTable(text, path, { ...table, enabled }))
      }
      return { ...existing, enabled }
    }
    const result = this.writeQueue.then(run)
    this.writeQueue = result.then(() => {}, () => {})
    return result
  }

  // ── Claude Code / CodeBuddy ──────────────────────────────────────────────

  private async listClaude(spec: Extract<PluginSourceSpec, { type: 'claude' }>): Promise<PluginInfo[]> {
    const [installed, settings] = await Promise.all([
      readJsonObject(spec.installedPath).catch(() => ({} as Raw)),
      readJsonObject(spec.settingsPath).catch(() => ({} as Raw)),
    ])
    const enabledMap = (settings.enabledPlugins ?? {}) as Record<string, unknown>
    const plugins = (installed.plugins ?? {}) as Record<string, unknown>
    const ids = new Set([...Object.keys(plugins), ...Object.keys(enabledMap)])

    return [...ids].sort().map(id => {
      const installs = Array.isArray(plugins[id]) ? (plugins[id] as Raw[]) : []
      const primary = installs.find(i => i.scope === 'user') ?? installs[0]
      const { name, source } = splitId(id)
      return {
        id,
        name,
        source,
        version: typeof primary?.version === 'string' && primary.version !== 'unknown' ? primary.version : undefined,
        scope: installs.length > 0 ? [...new Set(installs.map(i => String(i.scope ?? '')))].filter(Boolean).join(', ') : undefined,
        installPath: typeof primary?.installPath === 'string' ? primary.installPath : undefined,
        enabled: enabledMap[id] === true,
        toggleable: true,
        platformId: this.platformId,
      }
    })
  }

  // ── Codex ────────────────────────────────────────────────────────────────

  private async listCodex(spec: Extract<PluginSourceSpec, { type: 'codex' }>): Promise<PluginInfo[]> {
    const text = await readTextOrNull(spec.configPath)
    if (text === null) return []
    const plugins = getTomlTable(readToml(text), ['plugins']) ?? {}
    return Promise.all(Object.entries(plugins).map(async ([id, raw]) => {
      const { name, source } = splitId(id)
      const installPath = source ? await latestVersionDir(join(spec.cacheDir, source, name)) : null
      return {
        id,
        name,
        source,
        ...(installPath ? { installPath, version: basename(installPath) } : {}),
        enabled: (raw as Raw)?.enabled !== false,
        toggleable: true,
        platformId: this.platformId,
      }
    }))
  }

  // ── OpenCode ─────────────────────────────────────────────────────────────

  private async listOpencode(spec: Extract<PluginSourceSpec, { type: 'opencode' }>): Promise<PluginInfo[]> {
    const doc = await readJsonObject(spec.configPath).catch(() => ({} as Raw))
    const list = Array.isArray(doc.plugin) ? doc.plugin.map(String) : []
    return list.map(id => ({
      id,
      name: id.replace(/@[^@/]*$/, '') || id,
      source: 'npm',
      enabled: true,
      // OpenCode has no per-plugin disable flag; removing would lose the entry.
      toggleable: false,
      platformId: this.platformId,
    }))
  }

  // ── Cursor ───────────────────────────────────────────────────────────────

  private async listCursor(spec: Extract<PluginSourceSpec, { type: 'cursor' }>): Promise<PluginInfo[]> {
    const result: PluginInfo[] = []
    let marketplaces: string[]
    try {
      marketplaces = await readdir(spec.cacheDir)
    } catch {
      return []
    }
    for (const market of marketplaces) {
      let names: string[]
      try {
        names = await readdir(join(spec.cacheDir, market))
      } catch {
        continue
      }
      for (const name of names) {
        const installPath = await latestVersionDir(join(spec.cacheDir, market, name))
        if (!installPath) continue
        let version: string | undefined
        try {
          const manifest = JSON.parse(await readFile(join(installPath, '.cursor-plugin', 'plugin.json'), 'utf-8')) as Raw
          if (typeof manifest.version === 'string') version = manifest.version
        } catch { /* no manifest */ }
        result.push({
          id: `${name}@${market}`,
          name,
          source: market,
          version: version ?? basename(installPath).slice(0, 7),
          installPath,
          enabled: true,
          toggleable: false,
          platformId: this.platformId,
        })
      }
    }
    return result
  }
}
