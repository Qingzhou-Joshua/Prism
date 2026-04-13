import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { UnifiedRule, CreateRuleDto, UpdateRuleDto } from '@prism/shared'

export interface RuleStore {
  list(): Promise<UnifiedRule[]>
  get(id: string): Promise<UnifiedRule | null>
  create(dto: CreateRuleDto): Promise<UnifiedRule>
  update(id: string, dto: UpdateRuleDto): Promise<UnifiedRule>
  delete(id: string): Promise<boolean>
}

export class FileRuleStore implements RuleStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  private async load(): Promise<UnifiedRule[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('rules.json: expected array')
      return parsed as UnifiedRule[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw err
    }
  }

  private async save(rules: UnifiedRule[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(rules, null, 2), 'utf-8')
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(
      () => {},
      () => {}
    )
    return result
  }

  async list(): Promise<UnifiedRule[]> {
    return this.load()
  }

  async get(id: string): Promise<UnifiedRule | null> {
    const rules = await this.load()
    return rules.find((r) => r.id === id) ?? null
  }

  async create(dto: CreateRuleDto): Promise<UnifiedRule> {
    return this.enqueue(async () => {
      const rules = await this.load()
      const now = new Date().toISOString()
      const rule: UnifiedRule = {
        id: randomUUID(),
        name: dto.name,
        content: dto.content,
        scope: dto.scope,
        tags: dto.tags ?? [],
        platformOverrides: dto.platformOverrides ?? {},
        createdAt: now,
        updatedAt: now,
      }
      rules.push(rule)
      await this.save(rules)
      return rule
    })
  }

  async update(id: string, dto: UpdateRuleDto): Promise<UnifiedRule> {
    return this.enqueue(async () => {
      const rules = await this.load()
      const index = rules.findIndex((r) => r.id === id)
      if (index === -1) throw new Error(`Rule not found: ${id}`)
      const updated: UnifiedRule = {
        ...rules[index],
        ...dto,
        updatedAt: new Date().toISOString(),
      }
      rules[index] = updated
      await this.save(rules)
      return updated
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const rules = await this.load()
      const index = rules.findIndex((r) => r.id === id)
      if (index === -1) return false
      rules.splice(index, 1)
      await this.save(rules)
      return true
    })
  }
}
