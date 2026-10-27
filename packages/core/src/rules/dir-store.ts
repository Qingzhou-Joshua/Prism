import { readdir, readFile, writeFile, unlink, rename, mkdir, access } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import type { UnifiedRule, CreateRuleDto, UpdateRuleDto } from '@prism/shared'
import { ConflictError } from '@prism/shared'
import type { RuleStore } from './store.js'
import { ruleFileName } from '../publish/platform-paths.js'
import { fileNameToId, renderWithFrontMatter } from '../utils/dir-store-utils.js'

const RULE_PRISM_ONLY_KEYS = ['name', 'scope', 'tags', 'targetPlatforms', 'platformOverrides', 'createdAt', 'updatedAt']

/**
 * Serialise a rule to front-matter + content markdown, merging into the
 * file's existing front matter (`original`) so native fields survive.
 */
function serialise(rule: UnifiedRule, original: string | null = null): string {
  const overrideEntries = Object.entries(rule.platformOverrides ?? {})
  const overrideLines: string[] = []
  for (const [platformId, override] of overrideEntries) {
    overrideLines.push(`  ${platformId}:`)
    if (override && typeof override.content === 'string') {
      const escaped = override.content.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
      overrideLines.push(`    content: "${escaped}"`)
    }
  }
  return renderWithFrontMatter(
    original,
    [
      ['name', rule.name],
      ['scope', rule.scope],
      ['tags', rule.tags],
      ['targetPlatforms', rule.targetPlatforms ?? []],
      ['platformOverrides', overrideLines.length > 0 ? { raw: overrideLines } : undefined],
      ['createdAt', rule.createdAt],
      ['updatedAt', rule.updatedAt],
    ],
    rule.content,
    RULE_PRISM_ONLY_KEYS,
  )
}

/**
 * Parse a raw .md file into a partial UnifiedRule.
 * Returns null if the file cannot be parsed.
 */
function parseRuleFile(
  raw: string,
  fileName: string,
  now: string,
): Omit<UnifiedRule, 'id'> | null {
  const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)^---\r?\n?([\s\S]*)$/m
  const ext = fileName.endsWith('.mdc') ? '.mdc' : '.md'
  const plainFallback: Omit<UnifiedRule, 'id'> = {
    name: basename(fileName, ext),
    content: raw,
    scope: 'global',
    tags: [],
    targetPlatforms: [],
    platformOverrides: {},
    createdAt: now,
    updatedAt: now,
  }

  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) return plainFallback

  const match = FRONT_MATTER_RE.exec(raw)
  if (!match) return plainFallback

  const [, yamlBlock, body] = match
  const meta = parseYamlBlock(yamlBlock)

  return {
    name: typeof meta.name === 'string' ? meta.name : basename(fileName, ext),
    content: body.replace(/^\n/, ''),
    scope:
      typeof meta.scope === 'string' && (meta.scope === 'global' || meta.scope === 'platform-only' || meta.scope === 'override')
        ? meta.scope
        : 'global',
    tags: Array.isArray(meta.tags)
      ? (meta.tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [],
    targetPlatforms: Array.isArray(meta.targetPlatforms)
      ? (meta.targetPlatforms as unknown[]).filter((t): t is string => typeof t === 'string')
      : [],
    platformOverrides: (meta.platformOverrides as Record<string, { content: string }>) ?? {},
    createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : now,
    updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : now,
  }
}

function parseYamlBlock(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = block.split(/\r?\n/)

  // State: which top-level key we're currently under
  let topKey: string | null = null
  // When topKey has an object value, track the current nested key
  let nestedKey: string | null = null

  for (const line of lines) {
    if (line.trim() === '') continue

    const indent = line.length - line.trimStart().length

    if (indent === 0) {
      // Top-level key
      const m = /^([\w-]+):\s*(.*)$/.exec(line)
      if (!m) continue
      topKey = m[1]
      nestedKey = null
      const val = m[2].trim()
      if (val !== '') {
        result[topKey] = val
        topKey = null // scalar consumed
      }
      // else: leave topKey set, value comes from subsequent indented lines
    } else if (indent === 2 && topKey !== null) {
      // Could be a list item "  - foo" or a nested object key "  openclaw:"
      const listItemM = /^ {2}-\s+(.+)$/.exec(line)
      const nestedKvM = /^ {2}([\w-]+):\s*(.*)$/.exec(line)

      if (listItemM) {
        // List item under topKey
        nestedKey = null
        if (!Array.isArray(result[topKey])) result[topKey] = []
        ;(result[topKey] as string[]).push(listItemM[1].trim())
      } else if (nestedKvM) {
        // Nested object key under topKey
        nestedKey = nestedKvM[1]
        const val = nestedKvM[2].trim()
        if (typeof result[topKey] !== 'object' || Array.isArray(result[topKey])) {
          result[topKey] = {}
        }
        const map = result[topKey] as Record<string, unknown>
        if (val !== '') {
          map[nestedKey] = val
          nestedKey = null
        } else {
          map[nestedKey] = {}
        }
      }
    } else if (indent === 4 && topKey !== null && nestedKey !== null) {
      // Deep nested key:value, e.g. "    content: ..."
      const deepM = /^ {4}([\w-]+):\s*(.*)$/.exec(line)
      if (!deepM) continue
      const map = result[topKey] as Record<string, Record<string, string>>
      if (!map[nestedKey]) map[nestedKey] = {}
      let val = deepM[2].trim()
      // unescape YAML double-quoted scalar
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      }
      map[nestedKey][deepM[1]] = val
    }
  }

  return result
}

export class DirRuleStore implements RuleStore {
  /**
   * @param dirPath  rules directory
   * @param ext      extension for newly created rule files (existing files keep theirs)
   */
  constructor(
    private readonly dirPath: string,
    private readonly ext: '.md' | '.mdc' = '.md',
  ) {}

  async list(): Promise<UnifiedRule[]> {
    let entries
    try {
      entries = await readdir(this.dirPath, { withFileTypes: true })
    } catch {
      return []
    }

    const now = new Date().toISOString()
    const rules: UnifiedRule[] = []

    for (const entry of entries) {
      if (!entry.isFile() || (!entry.name.endsWith('.md') && !entry.name.endsWith('.mdc'))) continue
      const filePath = join(this.dirPath, entry.name)
      const raw = await readFile(filePath, 'utf-8')
      const parsed = parseRuleFile(raw, entry.name, now)
      if (!parsed) continue
      rules.push({ id: fileNameToId(entry.name), filePath, ...parsed })
    }

    return rules
  }

  async get(id: string): Promise<UnifiedRule | null> {
    const all = await this.list()
    return all.find((r) => r.id === id) ?? null
  }

  async create(dto: CreateRuleDto): Promise<UnifiedRule> {
    await mkdir(this.dirPath, { recursive: true })
    const now = new Date().toISOString()
    const fileName = ruleFileName(dto.name, this.ext)
    const filePath = join(this.dirPath, fileName)
    try {
      await access(filePath)
      throw new ConflictError(`Rule file ${fileName} already exists`)
    } catch (err) {
      if (err instanceof ConflictError) throw err
    }
    const rule: UnifiedRule = {
      id: fileNameToId(fileName),
      name: dto.name,
      content: dto.content,
      scope: dto.scope ?? 'global',
      tags: dto.tags ?? [],
      targetPlatforms: dto.targetPlatforms ?? [],
      platformOverrides: dto.platformOverrides ?? {},
      createdAt: now,
      updatedAt: now,
    }
    await writeFile(filePath, serialise(rule), 'utf-8')
    return { ...rule, filePath }
  }

  async update(id: string, dto: UpdateRuleDto): Promise<UnifiedRule | null> {
    const existing = await this.get(id)
    if (!existing || !existing.filePath) return null

    const oldFileName = basename(existing.filePath)
    const oldExt = extname(oldFileName) as '.md' | '.mdc'
    const renamed = dto.name !== undefined && dto.name !== existing.name
    const newFileName = renamed ? ruleFileName(dto.name!, oldExt) : oldFileName
    const now = new Date().toISOString()

    const updated: UnifiedRule = {
      ...existing,
      name: dto.name ?? existing.name,
      content: dto.content ?? existing.content,
      scope: dto.scope ?? existing.scope,
      tags: dto.tags ?? existing.tags,
      targetPlatforms: dto.targetPlatforms ?? existing.targetPlatforms,
      platformOverrides: dto.platformOverrides ?? existing.platformOverrides,
      updatedAt: now,
      id: fileNameToId(newFileName),
      filePath: join(this.dirPath, newFileName),
    }

    const original = await readFile(existing.filePath, 'utf-8')
    if (newFileName !== oldFileName) {
      await rename(existing.filePath, updated.filePath!)
    }
    await writeFile(updated.filePath!, serialise(updated, original), 'utf-8')
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id)
    if (!existing?.filePath) return false
    await unlink(existing.filePath)
    return true
  }
}
