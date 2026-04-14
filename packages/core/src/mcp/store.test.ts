import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileMcpStore } from './store.js'
import { rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('FileMcpStore', () => {
  let store: FileMcpStore
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `mcp-store-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    store = new FileMcpStore(join(testDir, 'servers.json'))
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('starts empty', async () => {
    const all = await store.findAll()
    expect(all).toHaveLength(0)
  })

  it('creates a server', async () => {
    const s = await store.create({ name: 'test', command: 'npx', args: ['-y', 'mcp'], targetPlatforms: ['claude-code'] })
    expect(s.id).toBeDefined()
    expect(s.name).toBe('test')
  })

  it('finds by id', async () => {
    const created = await store.create({ name: 's', command: 'cmd', args: [], targetPlatforms: [] })
    const found = await store.findById(created.id)
    expect(found?.name).toBe('s')
  })

  it('updates a server', async () => {
    const created = await store.create({ name: 'old', command: 'cmd', args: [], targetPlatforms: [] })
    const updated = await store.update(created.id, { name: 'new' })
    expect(updated?.name).toBe('new')
  })

  it('deletes a server', async () => {
    const created = await store.create({ name: 'd', command: 'cmd', args: [], targetPlatforms: [] })
    await store.delete(created.id)
    const found = await store.findById(created.id)
    expect(found).toBeNull()
  })

  it('importServers deduplicates by name', async () => {
    await store.create({ name: 'existing', command: 'old-cmd', args: [], targetPlatforms: [] })
    await store.importServers([
      { name: 'existing', command: 'new-cmd', args: ['--flag'], env: undefined },
      { name: 'brand-new', command: 'other', args: [], env: undefined },
    ])
    const all = await store.findAll()
    expect(all).toHaveLength(2)
    const existing = all.find(s => s.name === 'existing')
    expect(existing?.command).toBe('new-cmd')
  })
})
