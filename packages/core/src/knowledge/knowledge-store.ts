import { readdir, readFile, writeFile, unlink, mkdir, symlink, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type {
  DeveloperProfile,
  KnowledgeEntry,
  CreateKnowledgeEntryDto,
  GeneratedAsset,
  GenerateProjectRuleDto,
  PublishGeneratedAssetDto,
} from '@prism/shared'
import { getPlatformRulesDir, getPlatformSkillsDir } from '../publish/platform-paths.js'

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)^---\r?\n?([\s\S]*)$/m

function parseYamlBlock(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = block.split(/\r?\n/)
  let currentKey: string | null = null
  const listItems: string[] = []

  const flushList = () => {
    if (currentKey !== null && listItems.length > 0) {
      result[currentKey] = [...listItems]
    }
    listItems.length = 0
  }

  for (const line of lines) {
    const listItemMatch = /^\s+-\s+(.+)$/.exec(line)
    const keyValueMatch = /^([\w-]+):\s*(.*)$/.exec(line)

    if (listItemMatch) {
      listItems.push(listItemMatch[1].trim())
    } else if (keyValueMatch) {
      flushList()
      currentKey = keyValueMatch[1]
      const val = keyValueMatch[2].trim()
      if (val !== '') {
        result[currentKey] = val
        currentKey = null
      }
    }
  }

  flushList()
  return result
}

function parseFrontMatter(raw: string): { meta: Record<string, unknown>; body: string } {
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    return { meta: {}, body: raw }
  }
  const match = FRONT_MATTER_RE.exec(raw)
  if (!match) return { meta: {}, body: raw }
  const [, yamlBlock, body] = match
  return { meta: parseYamlBlock(yamlBlock), body: body.replace(/^\n/, '') }
}

function serialiseProfile(profile: DeveloperProfile): string {
  const lines: string[] = ['---']
  if (profile.name) lines.push(`name: ${profile.name}`)
  if (profile.role) lines.push(`role: ${profile.role}`)
  if (profile.skills.length > 0) {
    lines.push('skills:')
    for (const s of profile.skills) lines.push(`  - ${s}`)
  }
  lines.push(`updatedAt: ${profile.updatedAt}`)
  lines.push('---')
  lines.push(profile.bio)
  return lines.join('\n')
}

/** Escape a YAML scalar value that may contain special characters / newlines. */
function yamlScalar(value: string): string {
  // Use double-quoted YAML string: escape backslashes, double-quotes, and newlines
  if (!/[\n\r"\\]/.test(value)) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`
}

function serialiseEntry(entry: KnowledgeEntry): string {
  const lines: string[] = ['---']
  lines.push(`id: ${entry.id}`)
  lines.push(`domain: ${entry.domain}`)
  lines.push(`summary: ${yamlScalar(entry.summary)}`)
  if (entry.tags.length > 0) {
    lines.push('tags:')
    for (const t of entry.tags) lines.push(`  - ${t}`)
  }
  if (entry.projectPath) lines.push(`projectPath: ${yamlScalar(entry.projectPath)}`)
  lines.push(`sessionDate: ${entry.sessionDate}`)
  lines.push(`createdAt: ${entry.createdAt}`)
  lines.push('---')
  lines.push(entry.content)
  return lines.join('\n')
}

export class KnowledgeStore {
  private readonly entriesDir: string
  private readonly profilePath: string
  private readonly generatedDir: string

  constructor(private readonly baseDir: string) {
    this.entriesDir = join(baseDir, 'entries')
    this.profilePath = join(baseDir, 'developer-profile.md')
    this.generatedDir = join(baseDir, 'generated')
  }

  async getProfile(): Promise<DeveloperProfile> {
    try {
      const raw = await readFile(this.profilePath, 'utf-8')
      const { meta, body } = parseFrontMatter(raw)
      const skills = Array.isArray(meta.skills)
        ? (meta.skills as unknown[]).filter((s): s is string => typeof s === 'string')
        : []
      return {
        name: typeof meta.name === 'string' ? meta.name : undefined,
        role: typeof meta.role === 'string' ? meta.role : undefined,
        bio: body,
        skills,
        updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : new Date().toISOString(),
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { bio: '', skills: [], updatedAt: new Date().toISOString() }
      }
      throw err
    }
  }

  async updateProfile(partial: Partial<DeveloperProfile>): Promise<DeveloperProfile> {
    const existing = await this.getProfile()
    const updated: DeveloperProfile = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    }
    await mkdir(this.baseDir, { recursive: true })
    await writeFile(this.profilePath, serialiseProfile(updated), 'utf-8')
    return updated
  }

  async listEntries(filter?: { domain?: string; projectPath?: string; since?: string }): Promise<KnowledgeEntry[]> {
    let files: string[]
    try {
      const dirents = await readdir(this.entriesDir, { withFileTypes: true })
      files = dirents
        .filter(d => d.isFile() && d.name.endsWith('.md'))
        .map(d => d.name)
    } catch {
      return []
    }

    const entries: KnowledgeEntry[] = []
    for (const fileName of files) {
      const filePath = join(this.entriesDir, fileName)
      try {
        const raw = await readFile(filePath, 'utf-8')
        const entry = this.parseEntryFile(raw)
        if (!entry) continue

        if (filter?.domain && entry.domain !== filter.domain) continue
        if (filter?.projectPath && entry.projectPath !== filter.projectPath) continue
        if (filter?.since && entry.sessionDate < filter.since) continue

        entries.push(entry)
      } catch {
        // skip unreadable files
      }
    }

    return entries.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
  }

  async getEntry(id: string): Promise<KnowledgeEntry | null> {
    let files: string[]
    try {
      const dirents = await readdir(this.entriesDir, { withFileTypes: true })
      files = dirents
        .filter(d => d.isFile() && d.name.endsWith('.md'))
        .map(d => d.name)
    } catch {
      return null
    }

    for (const fileName of files) {
      const filePath = join(this.entriesDir, fileName)
      try {
        const raw = await readFile(filePath, 'utf-8')
        const entry = this.parseEntryFile(raw)
        if (entry?.id === id) return entry
      } catch {
        // skip
      }
    }
    return null
  }

  async appendEntry(dto: CreateKnowledgeEntryDto): Promise<KnowledgeEntry> {
    await mkdir(this.entriesDir, { recursive: true })

    const now = new Date().toISOString()
    const entryId = randomUUID()
    const datePrefix = dto.sessionDate.slice(0, 10) // YYYY-MM-DD
    const fileName = `${datePrefix}-${entryId}.md`

    const entry: KnowledgeEntry = {
      id: `${datePrefix}-${entryId}`,
      domain: dto.domain,
      summary: dto.summary,
      content: dto.content,
      tags: dto.tags,
      projectPath: dto.projectPath,
      sessionDate: dto.sessionDate,
      createdAt: now,
    }

    const filePath = join(this.entriesDir, fileName)
    await writeFile(filePath, serialiseEntry(entry), 'utf-8')
    return entry
  }

  async deleteEntry(id: string): Promise<boolean> {
    let files: string[]
    try {
      const dirents = await readdir(this.entriesDir, { withFileTypes: true })
      files = dirents
        .filter(d => d.isFile() && d.name.endsWith('.md'))
        .map(d => d.name)
    } catch {
      return false
    }

    for (const fileName of files) {
      const filePath = join(this.entriesDir, fileName)
      try {
        const raw = await readFile(filePath, 'utf-8')
        const entry = this.parseEntryFile(raw)
        if (entry?.id === id) {
          await unlink(filePath)
          return true
        }
      } catch {
        // skip
      }
    }
    return false
  }

  private parseEntryFile(raw: string): KnowledgeEntry | null {
    try {
      const { meta, body } = parseFrontMatter(raw)
      if (typeof meta.id !== 'string') return null

      const tags = Array.isArray(meta.tags)
        ? (meta.tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : []

      return {
        id: meta.id,
        domain: typeof meta.domain === 'string' ? meta.domain : 'general',
        summary: typeof meta.summary === 'string' ? meta.summary : '',
        content: body,
        tags,
        projectPath: typeof meta.projectPath === 'string' ? meta.projectPath : undefined,
        sessionDate: typeof meta.sessionDate === 'string' ? meta.sessionDate : '',
        createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : '',
      }
    } catch {
      return null
    }
  }

  // ─── Generated Asset: 序列化 / 反序列化 ────────────────────────────────────

  private serialiseGenerated(asset: GeneratedAsset): string {
    const { content, ...meta } = asset
    const publishedToJson = JSON.stringify(meta.publishedTo ?? [])
    const { publishedTo: _publishedTo, ...rest } = meta
    const frontmatter = Object.entries({ ...rest, publishedToJson })
      .map(([k, v]) => {
        if (v === undefined || v === null) return null
        if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`
        return `${k}: ${yamlScalar(String(v))}`
      })
      .filter((line): line is string => line !== null)
      .join('\n')
    return `---\n${frontmatter}\n---\n${content}`
  }

  private parseGeneratedFile(raw: string): GeneratedAsset | null {
    try {
      const { meta, body } = parseFrontMatter(raw)
      if (typeof meta.id !== 'string') return null
      if (meta.type !== 'rule' && meta.type !== 'skill') return null
      if (meta.sourceType !== 'developer-profile' && meta.sourceType !== 'knowledge-entries') return null

      let publishedTo: GeneratedAsset['publishedTo'] = []
      if (typeof meta.publishedToJson === 'string') {
        try {
          // yamlScalar() 将 JSON 字符串中的 " 转义为 \"，parseYamlBlock 读回时
          // 值会带上外层 " 和内部 \" 转义。需要还原：去掉首尾 " 并反转义。
          let raw = meta.publishedToJson
          if (raw.startsWith('"') && raw.endsWith('"')) {
            raw = raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
          }
          const parsed: unknown = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            publishedTo = parsed.filter(
              (item): item is { platformId: string; symlinkPath: string; linkedAt: string } =>
                typeof item === 'object' &&
                item !== null &&
                typeof (item as Record<string, unknown>).platformId === 'string' &&
                typeof (item as Record<string, unknown>).symlinkPath === 'string' &&
                typeof (item as Record<string, unknown>).linkedAt === 'string',
            )
          }
        } catch {
          // leave publishedTo as []
        }
      }

      const sourceIds = Array.isArray(meta.sourceIds)
        ? (meta.sourceIds as unknown[]).filter((s): s is string => typeof s === 'string')
        : undefined

      return {
        id: meta.id,
        type: meta.type,
        name: typeof meta.name === 'string' ? meta.name : '',
        content: body,
        sourceType: meta.sourceType,
        sourceIds,
        domain: typeof meta.domain === 'string' ? meta.domain : undefined,
        projectPath: typeof meta.projectPath === 'string' ? meta.projectPath : undefined,
        generatedAt: typeof meta.generatedAt === 'string' ? meta.generatedAt : '',
        publishedTo,
      }
    } catch {
      return null
    }
  }

  // ─── Generated Asset: CRUD ─────────────────────────────────────────────────

  async listGenerated(): Promise<GeneratedAsset[]> {
    let files: string[]
    try {
      const dirents = await readdir(this.generatedDir, { withFileTypes: true })
      files = dirents
        .filter(d => d.isFile() && d.name.endsWith('.md'))
        .map(d => d.name)
    } catch {
      return []
    }

    const assets: GeneratedAsset[] = []
    for (const fileName of files) {
      const filePath = join(this.generatedDir, fileName)
      try {
        const raw = await readFile(filePath, 'utf-8')
        const asset = this.parseGeneratedFile(raw)
        if (asset) assets.push(asset)
      } catch {
        // skip unreadable files
      }
    }
    return assets
  }

  async getGenerated(id: string): Promise<GeneratedAsset | null> {
    const filePath = join(this.generatedDir, `${id}.md`)
    try {
      const raw = await readFile(filePath, 'utf-8')
      return this.parseGeneratedFile(raw)
    } catch {
      return null
    }
  }

  async saveGenerated(asset: GeneratedAsset): Promise<GeneratedAsset> {
    await mkdir(this.generatedDir, { recursive: true })
    const filePath = join(this.generatedDir, `${asset.id}.md`)
    await writeFile(filePath, this.serialiseGenerated(asset), 'utf-8')
    return asset
  }

  async deleteGenerated(id: string): Promise<boolean> {
    const filePath = join(this.generatedDir, `${id}.md`)
    try {
      // 先读取 asset，清理所有已发布的 symlinks
      const asset = await this.getGenerated(id)
      if (asset) {
        for (const p of asset.publishedTo) {
          try {
            await unlink(p.symlinkPath)
          } catch {
            // symlink 可能已不存在，忽略
          }
        }
      }
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  // ─── Generated Asset: 生成方法 ─────────────────────────────────────────────

  async generateProfileRule(): Promise<GeneratedAsset> {
    const profile = await this.getProfile()

    // 幂等：如已有 developer-profile 类型的 asset，复用其 id 和 publishedTo
    const existing = (await this.listGenerated()).find(
      a => a.sourceType === 'developer-profile',
    )

    const name = profile.name || 'Developer'
    const content = [
      '---',
      `description: Developer profile context for ${name}`,
      '---',
      '# Developer Profile',
      '',
      `**Name**: ${profile.name ?? ''}  **Role**: ${profile.role ?? 'Developer'}`,
      '',
      `**Core Skills**: ${profile.skills.length > 0 ? profile.skills.join(', ') : 'Not specified'}`,
      '',
      profile.bio,
    ].join('\n')

    const asset: GeneratedAsset = {
      id: existing?.id ?? randomUUID(),
      type: 'rule',
      name: 'developer-profile-context',
      content,
      sourceType: 'developer-profile',
      generatedAt: new Date().toISOString(),
      publishedTo: existing?.publishedTo ?? [],
    }

    return this.saveGenerated(asset)
  }

  async generateProjectRule(dto: GenerateProjectRuleDto): Promise<GeneratedAsset> {
    const entries = await this.listEntries({
      domain: dto.domain,
      projectPath: dto.projectPath,
    })

    if (entries.length < 1) {
      throw new Error('No knowledge entries found for the given filter')
    }

    // 取最近 5 条 summary
    const recentSummaries = entries.slice(0, 5).map(e => `- ${e.summary}`).join('\n')

    // 提取所有 tags 去重
    const allTags = [...new Set(entries.flatMap(e => e.tags))]

    // 取最新 entry 的 content 前 2000 字
    const latestContent = entries[0].content.slice(0, 2000)

    const content = [
      '---',
      `description: Project context for ${dto.domain ?? dto.projectPath ?? 'general'}`,
      '---',
      '# Project Knowledge Context',
      '',
      `**Domain**: ${dto.domain ?? 'general'}`,
      dto.projectPath ? `**Project**: ${dto.projectPath}` : '',
      `**Tags**: ${allTags.length > 0 ? allTags.join(', ') : 'none'}`,
      '',
      '## Recent Session Summaries',
      '',
      recentSummaries,
      '',
      '## Latest Session Content',
      '',
      latestContent,
    ].filter(line => line !== undefined).join('\n')

    // 幂等：如已有同 domain+projectPath 的 'knowledge-entries' asset，复用
    const existing = (await this.listGenerated()).find(
      a =>
        a.sourceType === 'knowledge-entries' &&
        (a.domain ?? undefined) === (dto.domain ?? undefined) &&
        (a.projectPath ?? undefined) === (dto.projectPath ?? undefined),
    )

    const asset: GeneratedAsset = {
      id: existing?.id ?? randomUUID(),
      type: 'rule',
      name: `project-context-${dto.domain ?? dto.projectPath ?? 'general'}`,
      content,
      sourceType: 'knowledge-entries',
      sourceIds: entries.map(e => e.id),
      domain: dto.domain,
      projectPath: dto.projectPath,
      generatedAt: new Date().toISOString(),
      publishedTo: existing?.publishedTo ?? [],
    }

    return this.saveGenerated(asset)
  }

  // ─── Generated Asset: Symlink 发布 ─────────────────────────────────────────

  private getPlatformAssetDir(platformId: string, assetType: 'rule' | 'skill'): string {
    // platformId 对应 PlatformId，但此处接受 string 保持灵活性
    // 使用 platform-paths.ts 的辅助函数确定目录
    if (assetType === 'rule') {
      return getPlatformRulesDir(platformId as Parameters<typeof getPlatformRulesDir>[0])
    }
    return getPlatformSkillsDir(platformId as Parameters<typeof getPlatformSkillsDir>[0])
  }

  async publishGeneratedAsset(assetId: string, dto: PublishGeneratedAssetDto): Promise<GeneratedAsset> {
    const asset = await this.getGenerated(assetId)
    if (!asset) {
      throw new Error(`Generated asset not found: ${assetId}`)
    }

    const sourcePath = join(this.generatedDir, `${assetId}.md`)
    const targetDir = this.getPlatformAssetDir(dto.platformId, dto.assetType)

    // skill 类型需要子目录（与 PublishEngine 一致），rule 直接放到 targetDir
    let symlinkPath: string
    if (dto.assetType === 'skill') {
      const skillDirName = asset.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      const skillDir = join(targetDir, skillDirName)
      await mkdir(skillDir, { recursive: true })
      symlinkPath = join(skillDir, 'SKILL.md')
    } else {
      await mkdir(targetDir, { recursive: true })
      const fileName = asset.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '.md'
      symlinkPath = join(targetDir, fileName)
    }

    // 若目标已存在（文件或旧 symlink，含 dangling symlink），先删除
    // 使用 lstat 而非 access：access 会跟随 symlink，dangling symlink 会抛 ENOENT；lstat 只检查 link 本身
    try {
      await lstat(symlinkPath)
      await unlink(symlinkPath)
    } catch {
      // 目标不存在，无需 unlink
    }

    await symlink(sourcePath, symlinkPath)

    // 更新 publishedTo（追加或覆盖同 platformId 的记录）
    const linkedAt = new Date().toISOString()
    const existingIdx = asset.publishedTo.findIndex(p => p.platformId === dto.platformId)
    if (existingIdx >= 0) {
      asset.publishedTo[existingIdx] = { platformId: dto.platformId, symlinkPath, linkedAt }
    } else {
      asset.publishedTo.push({ platformId: dto.platformId, symlinkPath, linkedAt })
    }

    return this.saveGenerated(asset)
  }
}
