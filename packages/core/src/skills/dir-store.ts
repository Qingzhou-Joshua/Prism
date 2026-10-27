import { readdir, readFile, writeFile, rm, rename, mkdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { UnifiedSkill, CreateSkillDto, UpdateSkillDto } from '@prism/shared'
import type { SkillStore } from './store.js'
import { skillFileName } from '../publish/platform-paths.js'
import { parseSkillFile } from './parse.js'
import { fileNameToId, extractMetaTimes, renderWithFrontMatter, frontMatterString } from '../utils/dir-store-utils.js'

/**
 * Serialise a skill to front-matter + content markdown, merging into the
 * existing SKILL.md front matter (`original`) so native fields survive.
 */
function serialise(skill: UnifiedSkill, original: string | null = null): string {
  return renderWithFrontMatter(
    original,
    [
      ['name', skill.name],
      ['description', skill.description],
      ['trigger', skill.trigger],
      ['category', skill.category],
      ['arguments', skill.arguments],
      ['createdAt', skill.createdAt],
      ['updatedAt', skill.updatedAt],
    ],
    skill.content,
    ['createdAt', 'updatedAt'],
  )
}

/**
 * Each skill is stored as a subdirectory containing SKILL.md.
 * e.g. <skillsDir>/my-skill/SKILL.md
 *
 * The directory name is the stable identifier; the display name is
 * stored in the front matter of SKILL.md.
 */
export class DirSkillStore implements SkillStore {
  constructor(private readonly dirPath: string) {}

  async list(): Promise<UnifiedSkill[]> {
    let entries
    try {
      entries = await readdir(this.dirPath, { withFileTypes: true })
    } catch {
      return []
    }

    const now = new Date().toISOString()
    const skills: UnifiedSkill[] = []

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      const skillMdPath = join(this.dirPath, entry.name, 'SKILL.md')
      let raw: string
      try {
        raw = await readFile(skillMdPath, 'utf-8')
      } catch {
        // Directory exists but has no SKILL.md — skip
        continue
      }

      const parsed = parseSkillFile(raw)
      const meta = extractMetaTimes(raw, now)
      const name = frontMatterString(raw, 'name') || entry.name

      skills.push({
        id: fileNameToId(entry.name),
        name,
        description: parsed.description,
        content: parsed.content,
        trigger: parsed.trigger,
        category: parsed.category,
        arguments: parsed.arguments,
        tags: [],
        targetPlatforms: [],
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        filePath: skillMdPath,
      })
    }

    return skills
  }

  async get(id: string): Promise<UnifiedSkill | null> {
    const all = await this.list()
    return all.find((s) => s.id === id) ?? null
  }

  async create(dto: CreateSkillDto): Promise<UnifiedSkill> {
    await mkdir(this.dirPath, { recursive: true })
    const now = new Date().toISOString()
    const dirName = skillFileName(dto.name)
    const skillDir = join(this.dirPath, dirName)
    await mkdir(skillDir, { recursive: true })

    const skill: UnifiedSkill = {
      id: fileNameToId(dirName),
      name: dto.name,
      description: dto.description,
      content: dto.content,
      trigger: dto.trigger,
      category: dto.category,
      arguments: dto.arguments,
      tags: dto.tags ?? [],
      targetPlatforms: dto.targetPlatforms ?? [],
      createdAt: now,
      updatedAt: now,
    }
    await writeFile(join(skillDir, 'SKILL.md'), serialise(skill), 'utf-8')
    return skill
  }

  async update(id: string, dto: UpdateSkillDto): Promise<UnifiedSkill | null> {
    const existing = await this.get(id)
    if (!existing?.filePath) return null

    const updatedName = dto.name ?? existing.name
    // The on-disk directory name is the identity; only rename when the
    // display name actually changes.
    const oldDirName = basename(dirname(existing.filePath!))
    const newDirName = dto.name !== undefined && dto.name !== existing.name ? skillFileName(updatedName) : oldDirName
    const now = new Date().toISOString()

    const updated: UnifiedSkill = {
      ...existing,
      name: updatedName,
      description: 'description' in dto ? dto.description : existing.description,
      content: dto.content ?? existing.content,
      trigger: 'trigger' in dto ? dto.trigger : existing.trigger,
      category: 'category' in dto ? dto.category : existing.category,
      arguments: 'arguments' in dto ? dto.arguments : existing.arguments,
      tags: dto.tags ?? existing.tags,
      targetPlatforms: dto.targetPlatforms ?? existing.targetPlatforms,
      id: fileNameToId(newDirName),
      updatedAt: now,
      filePath: join(this.dirPath, newDirName, 'SKILL.md'),
    }

    const original = await readFile(existing.filePath!, 'utf-8')
    if (oldDirName !== newDirName) {
      await rename(join(this.dirPath, oldDirName), join(this.dirPath, newDirName))
    }

    await writeFile(updated.filePath!, serialise(updated, original), 'utf-8')
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id)
    if (!existing?.filePath) return false
    const skillDir = dirname(existing.filePath)
    // Never delete outside the skills directory (e.g. through a bad symlink name)
    if (dirname(skillDir) !== this.dirPath) return false
    await rm(skillDir, { recursive: true, force: true })
    return true
  }
}
