import { stat } from 'node:fs/promises'
import type { McpServer, CreateMcpServerDto, UpdateMcpServerDto, ImportedMcpServer, McpTransport, PlatformId } from '@prism/shared'
import { ConflictError } from '@prism/shared'
import type { McpConfigSpec } from '../platforms/instances.js'
import type { McpStore } from './store.js'
import { readJsonObject, readTextOrNull, setJsonPath, writeTextAtomic } from '../utils/config-file.js'
import { getTomlTable, readToml, replaceTomlTable } from '../utils/toml-edit.js'

// ── NativeMcpStore ──────────────────────────────────────────────────────────
//
// Reads and writes MCP servers directly in a platform's own config file —
// Prism keeps no copy (卸载安全). Each dialect maps to/from McpServer; on update
// the existing native entry is merged so unknown fields (timeouts, cwd,
// alwaysAllow, …) are preserved.

type Raw = Record<string, unknown>

/** Fields Prism manages; everything else on a native entry is passed through. */
interface McpFields {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  type?: McpTransport
  url?: string
  headers?: Record<string, string>
  enabled?: boolean
}

export function mcpServerId(name: string): string {
  return encodeURIComponent(name)
}

/** Ids arrive either encoded or already URL-decoded by the router — accept both. */
function idToName(id: string): string {
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

function strRecord(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Raw)) out[k] = String(val)
  return Object.keys(out).length > 0 ? out : undefined
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : []
}

function isRemote(f: Pick<McpFields, 'type' | 'url' | 'command'>): boolean {
  return f.type === 'http' || f.type === 'sse' || (!!f.url && !f.command)
}

// ── Dialect codecs ──────────────────────────────────────────────────────────

const codecs = {
  standard: {
    rootKey: ['mcpServers'],
    decode(name: string, raw: Raw): McpFields {
      const url = typeof raw.url === 'string' ? raw.url : undefined
      const rawType = typeof raw.type === 'string' ? raw.type : undefined
      const remote = !!url || rawType === 'http' || rawType === 'sse' || rawType === 'streamable-http'
      return {
        name,
        command: typeof raw.command === 'string' ? raw.command : '',
        args: strArray(raw.args),
        env: strRecord(raw.env),
        type: remote ? (rawType === 'sse' ? 'sse' : 'http') : 'stdio',
        url,
        headers: strRecord(raw.headers),
        enabled: raw.disabled !== true,
      }
    },
    encode(f: McpFields, prev: Raw = {}): Raw {
      const next: Raw = { ...prev }
      if (isRemote(f)) {
        delete next.command
        delete next.args
        delete next.env
        next.type = f.type === 'sse' ? 'sse' : (prev.type === 'streamable-http' ? 'streamable-http' : 'http')
        next.url = f.url ?? ''
        if (f.headers && Object.keys(f.headers).length > 0) next.headers = f.headers
        else delete next.headers
      } else {
        delete next.url
        delete next.headers
        if (prev.type !== undefined) next.type = 'stdio'
        next.command = f.command
        next.args = f.args
        if (f.env && Object.keys(f.env).length > 0) next.env = f.env
        else delete next.env
      }
      if (f.enabled === false) next.disabled = true
      else if ('disabled' in next) next.disabled = false
      return next
    },
  },
  opencode: {
    rootKey: ['mcp'],
    decode(name: string, raw: Raw): McpFields {
      const cmd = strArray(raw.command)
      const remote = raw.type === 'remote'
      return {
        name,
        command: remote ? '' : (cmd[0] ?? ''),
        args: remote ? [] : cmd.slice(1),
        env: strRecord(raw.environment),
        type: remote ? 'http' : 'stdio',
        url: typeof raw.url === 'string' ? raw.url : undefined,
        headers: strRecord(raw.headers),
        enabled: raw.enabled !== false,
      }
    },
    encode(f: McpFields, prev: Raw = {}): Raw {
      const next: Raw = { ...prev }
      if (isRemote(f)) {
        delete next.command
        delete next.environment
        next.type = 'remote'
        next.url = f.url ?? ''
        if (f.headers && Object.keys(f.headers).length > 0) next.headers = f.headers
        else delete next.headers
      } else {
        delete next.url
        delete next.headers
        next.type = 'local'
        next.command = [f.command, ...f.args]
        if (f.env && Object.keys(f.env).length > 0) next.environment = f.env
        else delete next.environment
      }
      if (f.enabled !== undefined) next.enabled = f.enabled
      return next
    },
  },
  codex: {
    rootKey: ['mcp_servers'],
    decode(name: string, raw: Raw): McpFields {
      const url = typeof raw.url === 'string' ? raw.url : undefined
      return {
        name,
        command: typeof raw.command === 'string' ? raw.command : '',
        args: strArray(raw.args),
        env: strRecord(raw.env),
        type: url ? 'http' : 'stdio',
        url,
        headers: strRecord(raw.http_headers),
        enabled: raw.enabled !== false,
      }
    },
    encode(f: McpFields, prev: Raw = {}): Raw {
      const next: Raw = { ...prev }
      if (isRemote(f)) {
        delete next.command
        delete next.args
        delete next.env
        next.url = f.url ?? ''
        if (f.headers && Object.keys(f.headers).length > 0) next.http_headers = f.headers
        else delete next.http_headers
      } else {
        delete next.url
        delete next.http_headers
        next.command = f.command
        next.args = f.args
        if (f.env && Object.keys(f.env).length > 0) next.env = f.env
        else delete next.env
      }
      if (f.enabled === false) next.enabled = false
      else if ('enabled' in next) next.enabled = true
      return next
    },
  },
} as const

// ── Store ───────────────────────────────────────────────────────────────────

export class NativeMcpStore implements McpStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly spec: McpConfigSpec,
    private readonly platformId: PlatformId,
  ) {}

  get filePath(): string {
    return this.spec.path
  }

  private get codec() {
    return codecs[this.spec.dialect]
  }

  private async readEntries(): Promise<Record<string, Raw>> {
    if (this.spec.format === 'toml') {
      const text = await readTextOrNull(this.spec.path)
      if (text === null) return {}
      return (getTomlTable(readToml(text), [...this.codec.rootKey]) ?? {}) as Record<string, Raw>
    }
    const doc = await readJsonObject(this.spec.path)
    const entries = doc[this.codec.rootKey[0]]
    return entries && typeof entries === 'object' && !Array.isArray(entries) ? (entries as Record<string, Raw>) : {}
  }

  private async writeEntry(name: string, value: Raw | undefined): Promise<void> {
    if (this.spec.format === 'toml') {
      const text = (await readTextOrNull(this.spec.path)) ?? ''
      await writeTextAtomic(this.spec.path, replaceTomlTable(text, [...this.codec.rootKey, name], value))
      return
    }
    await setJsonPath(this.spec.path, [...this.codec.rootKey, name], value)
  }

  private async fileTime(): Promise<string> {
    try {
      return (await stat(this.spec.path)).mtime.toISOString()
    } catch {
      return new Date().toISOString()
    }
  }

  private toServer(f: McpFields, time: string): McpServer {
    return {
      id: mcpServerId(f.name),
      name: f.name,
      command: f.command,
      args: f.args,
      ...(f.env ? { env: f.env } : {}),
      type: f.type,
      ...(f.url ? { url: f.url } : {}),
      ...(f.headers ? { headers: f.headers } : {}),
      enabled: f.enabled,
      targetPlatforms: [this.platformId],
      platformId: this.platformId,
      filePath: this.spec.path,
      createdAt: time,
      updatedAt: time,
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(() => {}, () => {})
    return result
  }

  async findAll(): Promise<McpServer[]> {
    const [entries, time] = await Promise.all([this.readEntries(), this.fileTime()])
    return Object.entries(entries)
      .filter(([, raw]) => raw && typeof raw === 'object')
      .map(([name, raw]) => this.toServer(this.codec.decode(name, raw), time))
  }

  async findById(id: string): Promise<McpServer | null> {
    const name = idToName(id)
    return (await this.findAll()).find(s => s.id === id || s.name === name || s.name === id) ?? null
  }

  async create(dto: CreateMcpServerDto): Promise<McpServer> {
    return this.enqueue(async () => {
      const entries = await this.readEntries()
      if (entries[dto.name]) throw new ConflictError(`MCP server "${dto.name}" already exists`)
      await this.writeEntry(dto.name, this.codec.encode({ ...dto, args: dto.args ?? [] }))
      return (await this.findById(mcpServerId(dto.name)))!
    })
  }

  async update(id: string, dto: UpdateMcpServerDto): Promise<McpServer | null> {
    return this.enqueue(async () => {
      const entries = await this.readEntries()
      const oldName = entries[id] ? id : idToName(id)
      const prev = entries[oldName]
      if (!prev) return null
      const current = this.codec.decode(oldName, prev)
      const merged: McpFields = {
        name: dto.name ?? current.name,
        command: dto.command ?? current.command,
        args: dto.args ?? current.args,
        env: 'env' in dto ? dto.env : current.env,
        type: dto.type ?? current.type,
        url: 'url' in dto ? dto.url : current.url,
        headers: 'headers' in dto ? dto.headers : current.headers,
        enabled: dto.enabled ?? current.enabled,
      }
      if (merged.name !== oldName) {
        if (entries[merged.name]) throw new ConflictError(`MCP server "${merged.name}" already exists`)
        await this.writeEntry(oldName, undefined)
      }
      await this.writeEntry(merged.name, this.codec.encode(merged, prev))
      return this.findById(mcpServerId(merged.name))
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const entries = await this.readEntries()
      const name = entries[id] ? id : idToName(id)
      if (!entries[name]) return false
      await this.writeEntry(name, undefined)
      return true
    })
  }

  /** Insert or overwrite (merging native extras) servers by name. */
  async importServers(servers: ImportedMcpServer[]): Promise<void> {
    return this.enqueue(async () => {
      const entries = await this.readEntries()
      for (const s of servers) {
        await this.writeEntry(s.name, this.codec.encode({ ...s, enabled: undefined }, entries[s.name]))
      }
    })
  }
}
