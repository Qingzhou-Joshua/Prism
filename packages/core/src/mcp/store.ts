import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { McpServer, CreateMcpServerDto, UpdateMcpServerDto, ImportedMcpServer } from '@prism/shared'

const DEFAULT_PATH = join(homedir(), '.prism', 'mcp-registry.json')

export interface McpStore {
  findAll(): Promise<McpServer[]>
  findById(id: string): Promise<McpServer | null>
  create(dto: CreateMcpServerDto): Promise<McpServer>
  update(id: string, dto: UpdateMcpServerDto): Promise<McpServer | null>
  delete(id: string): Promise<boolean>
  importServers(servers: ImportedMcpServer[]): Promise<void>
}

export class FileMcpStore implements McpStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string = DEFAULT_PATH) {}

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

  async findAll(): Promise<McpServer[]> {
    return this.load()
  }

  async findById(id: string): Promise<McpServer | null> {
    const servers = await this.load()
    return servers.find(s => s.id === id) ?? null
  }

  async create(dto: CreateMcpServerDto): Promise<McpServer> {
    return this.enqueue(async () => {
      const servers = await this.load()
      const now = new Date().toISOString()
      const server: McpServer = {
        ...dto,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      }
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
      const updated: McpServer = {
        ...servers[idx],
        ...dto,
        id,
        createdAt: servers[idx].createdAt,
        updatedAt: new Date().toISOString(),
      }
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
        const existingIdx = servers.findIndex(s => s.name.toLowerCase() === item.name.toLowerCase())
        if (existingIdx !== -1) {
          // update command/args/env for existing entry
          servers[existingIdx] = {
            ...servers[existingIdx],
            command: item.command,
            args: item.args,
            ...(item.env !== undefined ? { env: item.env } : {}),
            updatedAt: new Date().toISOString(),
          }
          dirty = true
        } else {
          // create new entry
          const now = new Date().toISOString()
          servers.push({
            id: randomUUID(),
            name: item.name,
            command: item.command,
            args: item.args,
            ...(item.env !== undefined ? { env: item.env } : {}),
            targetPlatforms: [],
            createdAt: now,
            updatedAt: now,
          })
          dirty = true
        }
      }

      if (dirty) {
        await this.save(servers)
      }
    })
  }
}
