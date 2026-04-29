import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { McpServer, CreateMcpServerDto, UpdateMcpServerDto, ImportedMcpServer } from '@prism/shared'
import { getPlatformMcpSettingsPath } from '../publish/platform-paths.js'

// ── McpStore interface ──────────────────────────────────────────────────────

export interface McpStore {
  findAll(): Promise<McpServer[]>
  findById(id: string): Promise<McpServer | null>
  create(dto: CreateMcpServerDto): Promise<McpServer>
  update(id: string, dto: UpdateMcpServerDto): Promise<McpServer | null>
  delete(id: string): Promise<boolean>
  importServers(servers: ImportedMcpServer[]): Promise<void>
}

// ── Native settings.json types ──────────────────────────────────────────────

interface NativeMcpEntry {
  command: string
  args: string[]
  env?: Record<string, string>
}

type SettingsJson = {
  [key: string]: unknown
  mcpServers?: Record<string, NativeMcpEntry>
}

// ── Prism metadata stored in ~/.prism/mcp-meta.json ────────────────────────

interface McpMeta {
  id: string
  name: string
  description?: string
  targetPlatforms: string[]
  createdAt: string
  updatedAt: string
}

// ── IdeSettingsMcpStore ─────────────────────────────────────────────────────
//
// Follows the 卸载安全 principle:
//   - MCP command/args/env live in ~/.claude-internal/settings.json (mcpServers key)
//   - Prism metadata (id, description, targetPlatforms, timestamps) live in
//     ~/.prism/mcp-meta.json
//   - ~/.prism/mcp-registry.json (old FileMcpStore path) is migrated and removed
//     on first load
//
// Only claude-code has an MCP settings path; for other platforms we return an
// empty list (no write target).  All CRUD operations target claude-code's
// settings.json unless the path doesn't exist (shouldn't happen in practice).

export class IdeSettingsMcpStore implements McpStore {
  private writeQueue: Promise<void> = Promise.resolve()

  /** path to ~/.claude-internal/settings.json (or null if platform unsupported) */
  private readonly settingsPath: string | null

  /** path to ~/.prism/mcp-meta.json */
  private readonly metaPath: string

  /** path to the old mcp-registry.json — read once for migration */
  private readonly legacyPath: string

  constructor(
    settingsPath?: string | null,
    metaPath?: string,
    legacyPath?: string,
  ) {
    // Default: use claude-code settings.json
    this.settingsPath = settingsPath !== undefined
      ? settingsPath
      : getPlatformMcpSettingsPath('claude-code')
    this.metaPath = metaPath ?? join(homedir(), '.prism', 'mcp-meta.json')
    this.legacyPath = legacyPath ?? join(homedir(), '.prism', 'mcp-registry.json')
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async loadSettings(): Promise<{ mcpServers: Record<string, NativeMcpEntry>; raw: SettingsJson }> {
    if (!this.settingsPath) {
      return { mcpServers: {}, raw: {} }
    }
    try {
      const text = await readFile(this.settingsPath, 'utf-8')
      const raw = JSON.parse(text) as SettingsJson
      return { mcpServers: raw.mcpServers ?? {}, raw }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { mcpServers: {}, raw: {} }
      }
      if (err instanceof SyntaxError) {
        throw new Error(`settings.json at ${this.settingsPath} is corrupted: ${err.message}`)
      }
      throw err
    }
  }

  private async saveSettings(mcpServers: Record<string, NativeMcpEntry>, raw: SettingsJson): Promise<void> {
    if (!this.settingsPath) return
    const output: SettingsJson = { ...raw, mcpServers }
    await mkdir(dirname(this.settingsPath), { recursive: true })
    await writeFile(this.settingsPath, JSON.stringify(output, null, 2), 'utf-8')
  }

  private async loadMeta(): Promise<McpMeta[]> {
    try {
      const text = await readFile(this.metaPath, 'utf-8')
      return JSON.parse(text) as McpMeta[]
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      if (err instanceof SyntaxError) {
        throw new Error(`mcp-meta.json at ${this.metaPath} is corrupted: ${err.message}`)
      }
      throw err
    }
  }

  private async saveMeta(meta: McpMeta[]): Promise<void> {
    await mkdir(dirname(this.metaPath), { recursive: true })
    await writeFile(this.metaPath, JSON.stringify(meta, null, 2), 'utf-8')
  }

  /** One-shot migration: if old mcp-registry.json exists, import and delete it. */
  private migrationDone = false
  private async migrateIfNeeded(
    mcpServers: Record<string, NativeMcpEntry>,
    raw: SettingsJson,
    meta: McpMeta[],
  ): Promise<{ mcpServers: Record<string, NativeMcpEntry>; meta: McpMeta[] }> {
    if (this.migrationDone) return { mcpServers, meta }

    let legacy: McpServer[] = []
    try {
      const text = await readFile(this.legacyPath, 'utf-8')
      legacy = JSON.parse(text) as McpServer[]
    } catch {
      // no legacy file — nothing to migrate
      this.migrationDone = true
      return { mcpServers, meta }
    }

    if (legacy.length === 0) {
      this.migrationDone = true
      try { await unlink(this.legacyPath) } catch { /* ignore */ }
      return { mcpServers, meta }
    }

    let settingsDirty = false
    let metaDirty = false

    for (const server of legacy) {
      // Bring command/args/env into settings.json (skip if name already present)
      if (!mcpServers[server.name]) {
        mcpServers[server.name] = {
          command: server.command,
          args: server.args,
          ...(server.env !== undefined ? { env: server.env } : {}),
        }
        settingsDirty = true
      }
      // Bring Prism metadata (skip if id already present)
      if (!meta.find(m => m.id === server.id)) {
        meta.push({
          id: server.id,
          name: server.name,
          description: server.description,
          targetPlatforms: server.targetPlatforms as string[],
          createdAt: server.createdAt,
          updatedAt: server.updatedAt,
        })
        metaDirty = true
      }
    }

    if (settingsDirty) await this.saveSettings(mcpServers, raw)
    if (metaDirty) await this.saveMeta(meta)

    // Remove legacy file
    try { await unlink(this.legacyPath) } catch { /* ignore */ }

    this.migrationDone = true
    return { mcpServers, meta }
  }

  /** Load and merge: returns the combined McpServer[] view. */
  private async loadAll(): Promise<{
    servers: McpServer[]
    mcpServers: Record<string, NativeMcpEntry>
    raw: SettingsJson
    meta: McpMeta[]
  }> {
    const [{ mcpServers: rawMcp, raw }, rawMeta] = await Promise.all([
      this.loadSettings(),
      this.loadMeta(),
    ])

    const { mcpServers, meta } = await this.migrateIfNeeded(rawMcp, raw, rawMeta)

    // Build a lookup: name → meta
    const metaByName = new Map<string, McpMeta>(meta.map(m => [m.name, m]))

    const servers: McpServer[] = Object.entries(mcpServers).map(([name, entry]) => {
      const m = metaByName.get(name)
      const now = new Date().toISOString()
      return {
        id: m?.id ?? randomUUID(),
        name,
        command: entry.command,
        args: entry.args,
        ...(entry.env !== undefined ? { env: entry.env } : {}),
        description: m?.description,
        targetPlatforms: (m?.targetPlatforms ?? []) as McpServer['targetPlatforms'],
        createdAt: m?.createdAt ?? now,
        updatedAt: m?.updatedAt ?? now,
      }
    })

    return { servers, mcpServers, raw, meta }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(
      () => {},
      () => {},
    )
    return result
  }

  // ── Public McpStore interface ──────────────────────────────────────────────

  async findAll(): Promise<McpServer[]> {
    const { servers } = await this.loadAll()
    return servers
  }

  async findById(id: string): Promise<McpServer | null> {
    const { servers } = await this.loadAll()
    return servers.find(s => s.id === id) ?? null
  }

  async create(dto: CreateMcpServerDto): Promise<McpServer> {
    return this.enqueue(async () => {
      const { mcpServers, raw, meta } = await this.loadAll()

      const now = new Date().toISOString()
      const id = randomUUID()

      // Write to settings.json
      mcpServers[dto.name] = {
        command: dto.command,
        args: dto.args,
        ...(dto.env !== undefined ? { env: dto.env } : {}),
      }
      await this.saveSettings(mcpServers, raw)

      // Write Prism meta
      const newMeta: McpMeta = {
        id,
        name: dto.name,
        description: dto.description,
        targetPlatforms: dto.targetPlatforms as string[],
        createdAt: now,
        updatedAt: now,
      }
      meta.push(newMeta)
      await this.saveMeta(meta)

      return {
        ...dto,
        id,
        createdAt: now,
        updatedAt: now,
      }
    })
  }

  async update(id: string, dto: UpdateMcpServerDto): Promise<McpServer | null> {
    return this.enqueue(async () => {
      const { servers, mcpServers, raw, meta } = await this.loadAll()

      const existing = servers.find(s => s.id === id)
      if (!existing) return null

      const updated: McpServer = {
        ...existing,
        ...dto,
        id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      }

      // If name changed, rename key in settings.json
      const oldName = existing.name
      const newName = updated.name

      if (oldName !== newName) {
        delete mcpServers[oldName]
      }
      mcpServers[newName] = {
        command: updated.command,
        args: updated.args,
        ...(updated.env !== undefined ? { env: updated.env } : {}),
      }
      await this.saveSettings(mcpServers, raw)

      // Update meta
      const metaIdx = meta.findIndex(m => m.id === id)
      const newMeta: McpMeta = {
        id,
        name: newName,
        description: updated.description,
        targetPlatforms: updated.targetPlatforms as string[],
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      }
      if (metaIdx !== -1) {
        meta[metaIdx] = newMeta
      } else {
        meta.push(newMeta)
      }
      await this.saveMeta(meta)

      return updated
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const { servers, mcpServers, raw, meta } = await this.loadAll()

      const existing = servers.find(s => s.id === id)
      if (!existing) return false

      delete mcpServers[existing.name]
      await this.saveSettings(mcpServers, raw)

      const metaIdx = meta.findIndex(m => m.id === id)
      if (metaIdx !== -1) {
        meta.splice(metaIdx, 1)
        await this.saveMeta(meta)
      }

      return true
    })
  }

  async importServers(imported: ImportedMcpServer[]): Promise<void> {
    return this.enqueue(async () => {
      const { servers, mcpServers, raw, meta } = await this.loadAll()

      let settingsDirty = false
      let metaDirty = false
      const now = new Date().toISOString()

      for (const item of imported) {
        const existingServer = servers.find(s => s.name.toLowerCase() === item.name.toLowerCase())

        // Always upsert in settings.json
        mcpServers[item.name] = {
          command: item.command,
          args: item.args,
          ...(item.env !== undefined ? { env: item.env } : {}),
        }
        settingsDirty = true

        if (existingServer) {
          // Update meta timestamps only
          const metaIdx = meta.findIndex(m => m.id === existingServer.id)
          if (metaIdx !== -1) {
            meta[metaIdx] = { ...meta[metaIdx], name: item.name, updatedAt: now }
          }
          metaDirty = true
        } else {
          // New entry: create meta
          meta.push({
            id: randomUUID(),
            name: item.name,
            targetPlatforms: [],
            createdAt: now,
            updatedAt: now,
          })
          metaDirty = true
        }
      }

      if (settingsDirty) await this.saveSettings(mcpServers, raw)
      if (metaDirty) await this.saveMeta(meta)
    })
  }
}

// ── Legacy FileMcpStore (kept for reference / testing, deprecated) ──────────

/** @deprecated Use IdeSettingsMcpStore instead */
export class FileMcpStore implements McpStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string = join(homedir(), '.prism', 'mcp-registry.json')) {}

  private async load(): Promise<McpServer[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as McpServer[]
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      if (err instanceof SyntaxError) {
        throw new Error(`MCP store at ${this.filePath} is corrupted: ${err.message}`)
      }
      throw err
    }
  }

  private async save(servers: McpServer[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(servers, null, 2), 'utf-8')
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(
      () => {},
      () => {},
    )
    return result
  }

  async findAll(): Promise<McpServer[]> { return this.load() }
  async findById(id: string): Promise<McpServer | null> {
    return (await this.load()).find(s => s.id === id) ?? null
  }
  async create(dto: CreateMcpServerDto): Promise<McpServer> {
    return this.enqueue(async () => {
      const servers = await this.load()
      const now = new Date().toISOString()
      const server: McpServer = { ...dto, id: randomUUID(), createdAt: now, updatedAt: now }
      servers.push(server)
      await this.save(servers)
      return server
    })
  }
  async update(id: string, dto: UpdateMcpServerDto): Promise<McpServer | null> {
    return this.enqueue(async () => {
      const servers = await this.load()
      const idx = servers.findIndex(s => s.id === id)
      if (idx === -1) return null
      const updated: McpServer = { ...servers[idx], ...dto, id, createdAt: servers[idx].createdAt, updatedAt: new Date().toISOString() }
      servers[idx] = updated
      await this.save(servers)
      return updated
    })
  }
  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const servers = await this.load()
      const idx = servers.findIndex(s => s.id === id)
      if (idx === -1) return false
      servers.splice(idx, 1)
      await this.save(servers)
      return true
    })
  }
  async importServers(imported: ImportedMcpServer[]): Promise<void> {
    return this.enqueue(async () => {
      const servers = await this.load()
      let dirty = false
      for (const item of imported) {
        const idx = servers.findIndex(s => s.name.toLowerCase() === item.name.toLowerCase())
        if (idx !== -1) {
          servers[idx] = { ...servers[idx], command: item.command, args: item.args, ...(item.env !== undefined ? { env: item.env } : {}), updatedAt: new Date().toISOString() }
        } else {
          const now = new Date().toISOString()
          servers.push({ id: randomUUID(), name: item.name, command: item.command, args: item.args, ...(item.env !== undefined ? { env: item.env } : {}), targetPlatforms: [], createdAt: now, updatedAt: now })
        }
        dirty = true
      }
      if (dirty) await this.save(servers)
    })
  }
}
