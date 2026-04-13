import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { UnifiedSkill, CreateSkillDto, UpdateSkillDto } from '@prism/shared'

export interface SkillStore {
  list(): Promise<UnifiedSkill[]>
  get(id: string): Promise<UnifiedSkill | null>
  create(dto: CreateSkillDto): Promise<UnifiedSkill>
  update(id: string, dto: UpdateSkillDto): Promise<UnifiedSkill | null>
  delete(id: string): Promise<boolean>
}

export class FileSkillStore implements SkillStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  private async load(): Promise<UnifiedSkill[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as UnifiedSkill[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }

  private async save(skills: UnifiedSkill[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(skills, null, 2), 'utf-8')
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const outer = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    this.writeQueue = this.writeQueue.then(() => fn().then(resolve, reject))
    return outer
  }

  async list(): Promise<UnifiedSkill[]> {
    return this.load()
  }

  async get(id: string): Promise<UnifiedSkill | null> {
    const skills = await this.load()
    return skills.find(s => s.id === id) ?? null
  }

  async create(dto: CreateSkillDto): Promise<UnifiedSkill> {
    return this.enqueue(async () => {
      const skills = await this.load()
      const now = new Date().toISOString()
      const skill: UnifiedSkill = {
        ...dto,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      }
      skills.push(skill)
      await this.save(skills)
      return skill
    })
  }

  async update(id: string, dto: UpdateSkillDto): Promise<UnifiedSkill | null> {
    return this.enqueue(async () => {
      const skills = await this.load()
      const idx = skills.findIndex(s => s.id === id)
      if (idx === -1) return null
      const updated: UnifiedSkill = {
        ...skills[idx],
        ...dto,
        id,
        createdAt: skills[idx].createdAt,
        updatedAt: new Date().toISOString(),
      }
      skills[idx] = updated
      await this.save(skills)
      return updated
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const skills = await this.load()
      const idx = skills.findIndex(s => s.id === id)
      if (idx === -1) return false
      skills.splice(idx, 1)
      await this.save(skills)
      return true
    })
  }
}
