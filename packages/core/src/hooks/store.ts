import { readFile, writeFile, stat, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  UnifiedHook,
  CreateHookDto,
  UpdateHookDto,
  HookEventType,
  HookAction,
} from '@prism/shared'

// Native hooks.json format (as written by Claude Code / CodeBuddy)
interface NativeHookEntry {
  id?: string
  matcher: string
  description?: string
  hooks: HookAction[]
}

type NativeHooksFile = {
  [key: string]: unknown
  hooks?: {
    [eventType: string]: NativeHookEntry[]
  }
}

export interface HookStore {
  list(): Promise<UnifiedHook[]>
  get(id: string): Promise<UnifiedHook | null>
  create(dto: CreateHookDto): Promise<UnifiedHook>
  update(id: string, dto: UpdateHookDto): Promise<UnifiedHook | null>
  delete(id: string): Promise<boolean>
}

export class FileHookStore implements HookStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly platformId: string,
  ) {}

  private async load(): Promise<{ hooks: UnifiedHook[]; mtime: Date; raw: NativeHooksFile }> {
    try {
      const [raw, fileStat] = await Promise.all([
        readFile(this.filePath, 'utf-8').then(text => JSON.parse(text) as NativeHooksFile),
        stat(this.filePath),
      ])

      const mtime = fileStat.mtime
      const nativeHooks = raw.hooks ?? {}
      const hooks: UnifiedHook[] = []

      for (const [eventType, entries] of Object.entries(nativeHooks)) {
        if (!Array.isArray(entries)) continue
        for (const entry of entries) {
          hooks.push({
            id: entry.id ?? randomUUID(),
            eventType: eventType as HookEventType,
            matcher: entry.matcher,
            description: entry.description,
            actions: entry.hooks ?? [],
            platformId: this.platformId,
            createdAt: mtime.toISOString(),
            updatedAt: mtime.toISOString(),
          })
        }
      }

      return { hooks, mtime, raw }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { hooks: [], mtime: new Date(), raw: {} }
      }
      if (err instanceof SyntaxError) {
        throw new Error(`Hook store at ${this.filePath} is corrupted: ${err.message}`)
      }
      throw err
    }
  }

  private async save(hooks: UnifiedHook[], existingRaw: NativeHooksFile): Promise<void> {
    // Group hooks by eventType, stripping Prism metadata
    const grouped: Record<string, NativeHookEntry[]> = {}

    for (const hook of hooks) {
      if (!grouped[hook.eventType]) {
        grouped[hook.eventType] = []
      }
      const entry: NativeHookEntry = {
        matcher: hook.matcher,
        hooks: hook.actions,
      }
      if (hook.id) entry.id = hook.id
      if (hook.description) entry.description = hook.description
      grouped[hook.eventType].push(entry)
    }

    // Preserve other top-level fields (like $schema)
    const output: NativeHooksFile = { ...existingRaw, hooks: grouped }

    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(output, null, 2), 'utf-8')
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(
      () => {},
      () => {},
    )
    return result
  }

  async list(): Promise<UnifiedHook[]> {
    const { hooks } = await this.load()
    return hooks
  }

  async get(id: string): Promise<UnifiedHook | null> {
    const { hooks } = await this.load()
    return hooks.find(h => h.id === id) ?? null
  }

  async create(dto: CreateHookDto): Promise<UnifiedHook> {
    return this.enqueue(async () => {
      const { hooks, raw } = await this.load()
      const now = new Date().toISOString()
      const hook: UnifiedHook = {
        ...dto,
        id: randomUUID(),
        platformId: this.platformId,
        createdAt: now,
        updatedAt: now,
      }
      hooks.push(hook)
      await this.save(hooks, raw)
      return hook
    })
  }

  async update(id: string, dto: UpdateHookDto): Promise<UnifiedHook | null> {
    return this.enqueue(async () => {
      const { hooks, raw } = await this.load()
      const idx = hooks.findIndex(h => h.id === id)
      if (idx === -1) return null
      const updated: UnifiedHook = {
        ...hooks[idx],
        ...dto,
        id,
        platformId: this.platformId,
        createdAt: hooks[idx].createdAt,
        updatedAt: new Date().toISOString(),
      }
      hooks[idx] = updated
      await this.save(hooks, raw)
      return updated
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const { hooks, raw } = await this.load()
      const idx = hooks.findIndex(h => h.id === id)
      if (idx === -1) return false
      hooks.splice(idx, 1)
      await this.save(hooks, raw)
      return true
    })
  }
}
