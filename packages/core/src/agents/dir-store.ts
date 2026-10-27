import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { UnifiedAgent, CreateAgentDto, UpdateAgentDto, ImportedAgent } from '@prism/shared'
import type { AgentStore } from './store.js'
import { agentFileName } from '../publish/platform-paths.js'
import { parseAgentFile } from './parse.js'
import { fileNameToId, extractMetaTimes, renderWithFrontMatter } from '../utils/dir-store-utils.js'

/**
 * Serialise an agent to front-matter + content markdown, merging into the
 * existing file's front matter (`original`) so native fields survive.
 */
function serialise(agent: UnifiedAgent, original: string | null = null): string {
  return renderWithFrontMatter(
    original,
    [
      ['name', agent.name],
      ['description', agent.description],
      ['model', agent.model],
      ['tools', agent.tools],
      ['createdAt', agent.createdAt],
      ['updatedAt', agent.updatedAt],
    ],
    agent.content,
    ['createdAt', 'updatedAt'],
  )
}

export class DirAgentStore implements AgentStore {
  constructor(private readonly dirPath: string) {}

  async list(): Promise<UnifiedAgent[]> {
    let entries
    try {
      entries = await readdir(this.dirPath, { withFileTypes: true })
    } catch {
      return []
    }

    const now = new Date().toISOString()
    const agents: UnifiedAgent[] = []

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const filePath = join(this.dirPath, entry.name)
      const raw = await readFile(filePath, 'utf-8')
      const parsed = parseAgentFile(raw, entry.name)
      const meta = extractMetaTimes(raw, now)

      agents.push({
        id: fileNameToId(entry.name),
        name: parsed.name || basename(entry.name, '.md'),
        description: parsed.description,
        content: parsed.content,
        tools: parsed.tools,
        model: parsed.model,
        tags: [],
        targetPlatforms: [],
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        filePath,
      })
    }

    return agents
  }

  async get(id: string): Promise<UnifiedAgent | null> {
    const all = await this.list()
    return all.find((a) => a.id === id) ?? null
  }

  async create(dto: CreateAgentDto): Promise<UnifiedAgent> {
    await mkdir(this.dirPath, { recursive: true })
    const now = new Date().toISOString()
    const fileName = agentFileName(dto.name)
    const agent: UnifiedAgent = {
      id: fileNameToId(fileName),
      name: dto.name,
      description: dto.description,
      content: dto.content,
      tools: dto.tools,
      model: dto.model,
      tags: dto.tags ?? [],
      targetPlatforms: dto.targetPlatforms ?? [],
      createdAt: now,
      updatedAt: now,
    }
    await writeFile(join(this.dirPath, fileName), serialise(agent), 'utf-8')
    return agent
  }

  async update(id: string, dto: UpdateAgentDto): Promise<UnifiedAgent | null> {
    const existing = await this.get(id)
    if (!existing?.filePath) return null

    const now = new Date().toISOString()
    const updated: UnifiedAgent = {
      ...existing,
      name: dto.name ?? existing.name,
      description: 'description' in dto ? dto.description : existing.description,
      content: dto.content ?? existing.content,
      tools: 'tools' in dto ? dto.tools : existing.tools,
      model: 'model' in dto ? dto.model : existing.model,
      tags: dto.tags ?? existing.tags,
      targetPlatforms: dto.targetPlatforms ?? existing.targetPlatforms,
      updatedAt: now,
    }

    const original = await readFile(existing.filePath!, 'utf-8')
    await writeFile(existing.filePath!, serialise(updated, original), 'utf-8')
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id)
    if (!existing?.filePath) return false
    await unlink(existing.filePath)
    return true
  }

  async importAgents(imported: ImportedAgent[]): Promise<{ imported: number; skipped: number }> {
    await mkdir(this.dirPath, { recursive: true })
    const existing = await this.list()
    const existingNames = new Set(existing.map((a) => a.name.toLowerCase()))
    // Also track existing file names (kebab-case) so we can detect duplicates
    // even when the imported content has no front matter and the name is derived
    // from the file basename rather than the display name.
    const existingFileNames = new Set(existing.map((a) => agentFileName(a.name)))
    let importedCount = 0
    let skipped = 0

    for (const item of imported) {
      const parsed = parseAgentFile(item.content, item.fileName)
      const name = parsed.name || item.fileName.replace(/\.md$/i, '')

      if (existingNames.has(name.toLowerCase()) || existingFileNames.has(item.fileName)) {
        skipped++
        continue
      }

      const now = new Date().toISOString()
      const agent: UnifiedAgent = {
        id: fileNameToId(item.fileName),
        name,
        description: parsed.description,
        content: parsed.content,
        tools: parsed.tools,
        model: parsed.model,
        tags: [],
        targetPlatforms: [],
        createdAt: now,
        updatedAt: now,
      }
      await writeFile(join(this.dirPath, item.fileName), serialise(agent), 'utf-8')
      existingNames.add(name.toLowerCase())
      importedCount++
    }

    return { imported: importedCount, skipped }
  }
}
