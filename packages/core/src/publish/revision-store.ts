import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { access } from 'node:fs/promises'
import type { Revision } from '@prism/shared'

export class FileRevisionStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly revisionsDir: string,
    private readonly backupsDir: string,
  ) {}

  async save(revision: Revision): Promise<void> {
    return this.enqueue(async () => {
      await mkdir(this.revisionsDir, { recursive: true })
      const dateKey = revision.publishedAt.slice(0, 10)
      const filePath = join(this.revisionsDir, `${dateKey}.json`)
      const existing = await this.loadDateFile(filePath)
      existing.push(revision)
      await writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8')
    })
  }

  async get(id: string): Promise<Revision | null> {
    const dateKeys = await this.listDateKeys()
    for (const key of dateKeys) {
      const filePath = join(this.revisionsDir, `${key}.json`)
      const revisions = await this.loadDateFile(filePath)
      const found = revisions.find((r) => r.id === id)
      if (found) return found
    }
    return null
  }

  async listAll(): Promise<Revision[]> {
    const dateKeys = await this.listDateKeys()
    const all: Revision[] = []
    for (const key of dateKeys) {
      const filePath = join(this.revisionsDir, `${key}.json`)
      const revisions = await this.loadDateFile(filePath)
      all.push(...revisions)
    }
    all.sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : a.publishedAt < b.publishedAt ? 1 : 0))
    return all
  }

  async rollback(id: string): Promise<void> {
    const revision = await this.get(id)
    if (!revision) {
      throw new Error(`Revision not found: ${id}`)
    }
    for (const file of revision.files) {
      if (file.isNew) {
        await rm(file.filePath, { force: true })
      } else {
        if (!file.backupPath) {
          throw new Error(`Missing backup path for file: ${file.filePath}`)
        }
        await this.assertFileExists(file.backupPath)
        await mkdir(dirname(file.filePath), { recursive: true })
        await copyFile(file.backupPath, file.filePath)
      }
    }
  }

  private async listDateKeys(): Promise<string[]> {
    try {
      const entries = await readdir(this.revisionsDir)
      return entries
        .filter((e) => e.endsWith('.json'))
        .map((e) => e.replace('.json', ''))
        .sort()
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw err
    }
  }

  private async loadDateFile(filePath: string): Promise<Revision[]> {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed as Revision[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw err
    }
  }

  private async assertFileExists(filePath: string): Promise<void> {
    try {
      await access(filePath)
    } catch {
      throw new Error(`Backup file missing: ${filePath}`)
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(
      () => {},
      () => {},
    )
    return result
  }
}
