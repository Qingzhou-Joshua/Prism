import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { UnifiedAgent, CreateAgentDto, UpdateAgentDto, ImportedAgent } from '@prism/shared'
import { parseAgentFile } from './parse.js'

export interface AgentStore {
  list(): Promise<UnifiedAgent[]>
  get(id: string): Promise<UnifiedAgent | null>
  create(dto: CreateAgentDto): Promise<UnifiedAgent>
  update(id: string, dto: UpdateAgentDto): Promise<UnifiedAgent | null>
  delete(id: string): Promise<boolean>
  importAgents(agents: ImportedAgent[]): Promise<{ imported: number; skipped: number }>
}

export class FileAgentStore implements AgentStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  private async load(): Promise<UnifiedAgent[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as UnifiedAgent[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }

  private async save(agents: UnifiedAgent[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(agents, null, 2), 'utf-8')
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(
      () => {},
      () => {},
    )
    return result
  }

  async list(): Promise<UnifiedAgent[]> {
    return this.load()
  }

  async get(id: string): Promise<UnifiedAgent | null> {
    const agents = await this.load()
    return agents.find(a => a.id === id) ?? null
  }

  async create(dto: CreateAgentDto): Promise<UnifiedAgent> {
    return this.enqueue(async () => {
      const agents = await this.load()
      const now = new Date().toISOString()
      const agent: UnifiedAgent = {
        ...dto,
        tags: dto.tags ?? [],
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      }
      agents.push(agent)
      await this.save(agents)
      return agent
    })
  }

  async update(id: string, dto: UpdateAgentDto): Promise<UnifiedAgent | null> {
    return this.enqueue(async () => {
      const agents = await this.load()
      const idx = agents.findIndex(a => a.id === id)
      if (idx === -1) return null
      const updated: UnifiedAgent = {
        ...agents[idx],
        ...dto,
        id,
        createdAt: agents[idx].createdAt,
        updatedAt: new Date().toISOString(),
      }
      agents[idx] = updated
      await this.save(agents)
      return updated
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const agents = await this.load()
      const idx = agents.findIndex(a => a.id === id)
      if (idx === -1) return false
      agents.splice(idx, 1)
      await this.save(agents)
      return true
    })
  }

  async importAgents(imported: ImportedAgent[]): Promise<{ imported: number; skipped: number }> {
    return this.enqueue(async () => {
      const agents = await this.load()
      const existingNames = new Set(agents.map(a => a.name.toLowerCase()))
      let importedCount = 0
      let skipped = 0

      for (const item of imported) {
        const parsed = parseAgentFile(item.content, item.fileName)
        const name = parsed.name || item.fileName.replace(/\.md$/i, '')

        if (existingNames.has(name.toLowerCase())) {
          skipped++
          continue
        }

        const now = new Date().toISOString()
        agents.push({
          id: randomUUID(),
          name,
          description: parsed.description,
          content: parsed.content,
          tools: parsed.tools,
          model: parsed.model,
          tags: [],
          targetPlatforms: [],
          createdAt: now,
          updatedAt: now,
        })
        existingNames.add(name.toLowerCase())
        importedCount++
      }

      await this.save(agents)
      return { imported: importedCount, skipped }
    })
  }
}
