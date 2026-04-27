import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileRuleStore } from './store.js'

describe('FileRuleStore', () => {
  let tmpDir: string
  let store: FileRuleStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'prism-test-'))
    store = new FileRuleStore(join(tmpDir, 'rules.json'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('list returns empty array when file does not exist', async () => {
    const rules = await store.list()
    expect(rules).toEqual([])
  })

  it('create adds a rule and returns it with id and timestamps', async () => {
    const rule = await store.create({
      name: 'Test Rule',
      content: 'No TODO comments',
      scope: 'global',
    })
    expect(rule.id).toBeDefined()
    expect(rule.name).toBe('Test Rule')
    expect(rule.content).toBe('No TODO comments')
    expect(rule.scope).toBe('global')
    expect(rule.tags).toEqual([])
    expect(rule.createdAt).toBeDefined()
    expect(rule.updatedAt).toBeDefined()
  })

  it('list returns all created rules', async () => {
    await store.create({ name: 'Rule A', content: 'a', scope: 'global' })
    await store.create({ name: 'Rule B', content: 'b', scope: 'platform-only' })
    const rules = await store.list()
    expect(rules).toHaveLength(2)
  })

  it('get returns rule by id', async () => {
    const created = await store.create({ name: 'My Rule', content: 'x', scope: 'global' })
    const found = await store.get(created.id)
    expect(found).toEqual(created)
  })

  it('get returns null for unknown id', async () => {
    const result = await store.get('nonexistent-id')
    expect(result).toBeNull()
  })

  it('update modifies rule fields and updates updatedAt', async () => {
    const created = await store.create({ name: 'Old Name', content: 'old', scope: 'global' })
    // 等待至少 1ms 确保 updatedAt 与 createdAt 不同
    await new Promise((resolve) => setTimeout(resolve, 1))
    const updated = await store.update(created.id, { name: 'New Name' })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('New Name')
    expect(updated!.content).toBe('old')
    expect(updated!.updatedAt).not.toBe(created.updatedAt)
  })

  it('update returns null for unknown id', async () => {
    const result = await store.update('bad-id', { name: 'X' })
    expect(result).toBeNull()
  })

  it('delete removes rule and returns true', async () => {
    const rule = await store.create({ name: 'To Delete', content: 'd', scope: 'global' })
    const result = await store.delete(rule.id)
    expect(result).toBe(true)
    expect(await store.list()).toHaveLength(0)
  })

  it('delete returns false for unknown id', async () => {
    const result = await store.delete('unknown-id')
    expect(result).toBe(false)
  })

  it('persists rules across store instances', async () => {
    const filePath = join(tmpDir, 'rules.json')
    const store1 = new FileRuleStore(filePath)
    const rule = await store1.create({ name: 'Persistent', content: 'x', scope: 'global' })

    const store2 = new FileRuleStore(filePath)
    const found = await store2.get(rule.id)
    expect(found).toEqual(rule)
  })
})
