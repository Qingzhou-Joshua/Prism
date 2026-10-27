import { readdir, readFile, writeFile, unlink, mkdir, rename } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { UnifiedCommand, CreateCommandDto, UpdateCommandDto, PlatformId } from '@prism/shared'
import type { CommandStore } from './store.js'
import { commandFileName } from '../publish/platform-paths.js'
import { parseCommandFile } from './parse.js'
import { fileNameToId, extractMetaTimes, renderWithFrontMatter } from '../utils/dir-store-utils.js'

/**
 * Serialise a command to front-matter + content markdown, merging into the
 * existing file's front matter (`original`) so native fields survive.
 */
function serialise(command: UnifiedCommand, original: string | null = null): string {
  return renderWithFrontMatter(
    original,
    [
      ['name', command.name],
      ['description', command.description],
      ['tags', command.tags],
      ['targetPlatforms', command.targetPlatforms],
      ['createdAt', command.createdAt],
      ['updatedAt', command.updatedAt],
    ],
    command.content,
    ['name', 'tags', 'targetPlatforms', 'createdAt', 'updatedAt'],
  )
}

export class DirCommandStore implements CommandStore {
  constructor(private readonly dirPath: string) {}

  async list(): Promise<UnifiedCommand[]> {
    let entries
    try {
      entries = await readdir(this.dirPath, { withFileTypes: true })
    } catch {
      return []
    }

    const now = new Date().toISOString()
    const commands: UnifiedCommand[] = []

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const filePath = join(this.dirPath, entry.name)
      const raw = await readFile(filePath, 'utf-8')
      const parsed = parseCommandFile(raw, entry.name)
      const meta = extractMetaTimes(raw, now)

      commands.push({
        id: fileNameToId(entry.name),
        name: parsed.name || basename(entry.name, '.md'),
        description: parsed.description,
        content: parsed.content,
        tags: parsed.tags ?? [],
        targetPlatforms: (parsed.targetPlatforms ?? []) as PlatformId[],
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        filePath,
      })
    }

    return commands
  }

  async get(id: string): Promise<UnifiedCommand | null> {
    const all = await this.list()
    return all.find((c) => c.id === id) ?? null
  }

  async create(dto: CreateCommandDto): Promise<UnifiedCommand> {
    await mkdir(this.dirPath, { recursive: true })
    const now = new Date().toISOString()
    const fileName = commandFileName(dto.name)
    const command: UnifiedCommand = {
      id: fileNameToId(fileName),
      name: dto.name,
      description: dto.description,
      content: dto.content,
      tags: dto.tags ?? [],
      targetPlatforms: dto.targetPlatforms ?? [],
      createdAt: now,
      updatedAt: now,
    }
    const filePath = join(this.dirPath, fileName)
    await writeFile(filePath, serialise(command), 'utf-8')
    return { ...command, filePath }
  }

  async update(id: string, dto: UpdateCommandDto): Promise<UnifiedCommand | null> {
    const existing = await this.get(id)
    if (!existing?.filePath) return null

    const now = new Date().toISOString()
    const updated: UnifiedCommand = {
      ...existing,
      name: dto.name ?? existing.name,
      description: 'description' in dto ? dto.description : existing.description,
      content: dto.content ?? existing.content,
      tags: dto.tags ?? existing.tags,
      targetPlatforms: dto.targetPlatforms ?? existing.targetPlatforms,
      updatedAt: now,
    }

    const oldPath = existing.filePath!
    const oldFileName = basename(oldPath)
    const newFileName = dto.name !== undefined && dto.name !== existing.name ? commandFileName(dto.name) : oldFileName
    const newPath = join(this.dirPath, newFileName)

    const original = await readFile(oldPath, 'utf-8')
    await writeFile(newPath, serialise(updated, original), 'utf-8')

    // Remove old file if name changed
    if (oldFileName !== newFileName) {
      try {
        await unlink(oldPath)
      } catch {
        // Old file may not exist — ignore
      }
    }

    return { ...updated, id: fileNameToId(newFileName), filePath: newPath }
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id)
    if (!existing?.filePath) return false
    await unlink(existing.filePath)
    return true
  }
}
