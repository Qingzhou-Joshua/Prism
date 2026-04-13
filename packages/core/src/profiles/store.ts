import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Profile, CreateProfileDto, UpdateProfileDto } from '@prism/shared'

export interface ProfileStore {
  list(): Promise<Profile[]>
  get(id: string): Promise<Profile | null>
  create(dto: CreateProfileDto): Promise<Profile>
  update(id: string, dto: UpdateProfileDto): Promise<Profile | null>
  delete(id: string): Promise<boolean>
}

export class FileProfileStore implements ProfileStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  private async load(): Promise<Profile[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('profiles.json: expected array')
      return parsed as Profile[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }

  private async save(profiles: Profile[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(profiles, null, 2), 'utf-8')
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(
      () => {},
      () => {},
    )
    return result
  }

  async list(): Promise<Profile[]> {
    return this.load()
  }

  async get(id: string): Promise<Profile | null> {
    const profiles = await this.load()
    return profiles.find((p) => p.id === id) ?? null
  }

  async create(dto: CreateProfileDto): Promise<Profile> {
    return this.enqueue(async () => {
      const profiles = await this.load()
      const now = new Date().toISOString()
      const profile: Profile = {
        id: randomUUID(),
        name: dto.name,
        description: dto.description ?? '',
        ruleIds: dto.ruleIds,
        targetPlatforms: dto.targetPlatforms,
        createdAt: now,
        updatedAt: now,
      }
      profiles.push(profile)
      await this.save(profiles)
      return profile
    })
  }

  async update(id: string, dto: UpdateProfileDto): Promise<Profile | null> {
    return this.enqueue(async () => {
      const profiles = await this.load()
      const index = profiles.findIndex((p) => p.id === id)
      if (index === -1) return null
      const updated: Profile = {
        ...profiles[index],
        ...dto,
        updatedAt: new Date().toISOString(),
      }
      profiles[index] = updated
      await this.save(profiles)
      return updated
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const profiles = await this.load()
      const index = profiles.findIndex((p) => p.id === id)
      if (index === -1) return false
      profiles.splice(index, 1)
      await this.save(profiles)
      return true
    })
  }
}
