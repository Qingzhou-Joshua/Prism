import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileHookStore } from './store.js'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('FileHookStore', () => {
  let store: FileHookStore
  let testDir: string
  let filePath: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `hook-store-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    filePath = join(testDir, 'hooks.json')
    store = new FileHookStore(filePath, 'claude-code')
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('starts empty when file does not exist', async () => {
    const all = await store.list()
    expect(all).toHaveLength(0)
  })

  it('creates a hook with an id', async () => {
    const hook = await store.create({
      eventType: 'PostToolUse',
      matcher: 'Write|Edit',
      actions: [{ type: 'command', command: 'pnpm format' }],
    })
    expect(hook.id).toBeDefined()
    expect(hook.eventType).toBe('PostToolUse')
    expect(hook.matcher).toBe('Write|Edit')
  })

  it('persists across store instances', async () => {
    await store.create({
      eventType: 'Stop',
      matcher: '.*',
      actions: [{ type: 'command', command: 'echo done' }],
    })
    const store2 = new FileHookStore(filePath, 'claude-code')
    const all = await store2.list()
    expect(all).toHaveLength(1)
  })

  it('gets a hook by id', async () => {
    const created = await store.create({
      eventType: 'PreToolUse',
      matcher: 'Bash',
      actions: [{ type: 'command', command: 'validate.sh' }],
    })
    const found = await store.get(created.id)
    expect(found?.matcher).toBe('Bash')
  })

  it('returns null for unknown id', async () => {
    const found = await store.get('does-not-exist')
    expect(found).toBeNull()
  })

  it('updates a hook', async () => {
    const created = await store.create({
      eventType: 'PostToolUse',
      matcher: 'Write',
      actions: [{ type: 'command', command: 'old' }],
    })
    const updated = await store.update(created.id, {
      actions: [{ type: 'command', command: 'new' }],
    })
    expect(updated?.actions[0]).toMatchObject({ command: 'new' })
  })

  it('deletes a hook', async () => {
    const created = await store.create({
      eventType: 'Stop',
      matcher: '.*',
      actions: [{ type: 'command', command: 'bye' }],
    })
    await store.delete(created.id)
    const found = await store.get(created.id)
    expect(found).toBeNull()
  })

  it('returns false when deleting a missing hook', async () => {
    const result = await store.delete('ghost-id')
    expect(result).toBe(false)
  })

  it('reads native hooks.json format', async () => {
    const native = {
      hooks: {
        PreToolUse: [
          {
            id: 'my-hook',
            matcher: 'Bash',
            description: 'Block dangerous flags',
            hooks: [{ type: 'command', command: 'validate.sh' }],
          },
        ],
        PostToolUse: [
          {
            matcher: 'Write|Edit',
            hooks: [{ type: 'command', command: 'pnpm format' }],
          },
        ],
      },
    }
    await writeFile(filePath, JSON.stringify(native), 'utf-8')

    const all = await store.list()
    expect(all).toHaveLength(2)

    const pre = all.find(h => h.eventType === 'PreToolUse')
    expect(pre?.id).toBe('my-hook')
    expect(pre?.description).toBe('Block dangerous flags')
    expect(pre?.actions[0]).toMatchObject({ type: 'command', command: 'validate.sh' })

    const post = all.find(h => h.eventType === 'PostToolUse')
    expect(post?.id).toBeDefined()
    expect(post?.matcher).toBe('Write|Edit')
  })

  it('preserves native format on write (no prism metadata)', async () => {
    const hook = await store.create({
      eventType: 'Stop',
      matcher: '.*',
      description: 'Final check',
      actions: [{ type: 'command', command: 'pnpm build' }],
    })

    const store2 = new FileHookStore(filePath, 'claude-code')
    const all = await store2.list()
    expect(all[0].id).toBe(hook.id)

    // Read raw file to verify no Prism fields were written
    const { readFile } = await import('node:fs/promises')
    const raw = JSON.parse(await readFile(filePath, 'utf-8'))
    const entries: unknown[] = raw.hooks?.Stop ?? []
    expect(entries).toHaveLength(1)
    const entry = entries[0] as Record<string, unknown>
    expect(entry).not.toHaveProperty('platformId')
    expect(entry).not.toHaveProperty('createdAt')
    expect(entry).not.toHaveProperty('updatedAt')
    expect(entry).not.toHaveProperty('eventType')
  })

  it('preserves $schema and other top-level fields', async () => {
    const native = {
      $schema: 'https://json.schemastore.org/claude-code-settings.json',
      hooks: {
        Stop: [{ matcher: '.*', hooks: [{ type: 'command', command: 'echo' }] }],
      },
    }
    await writeFile(filePath, JSON.stringify(native), 'utf-8')

    const all = await store.list()
    await store.update(all[0].id, { matcher: '.*' })

    const { readFile } = await import('node:fs/promises')
    const raw = JSON.parse(await readFile(filePath, 'utf-8'))
    expect(raw.$schema).toBe('https://json.schemastore.org/claude-code-settings.json')
  })
})
