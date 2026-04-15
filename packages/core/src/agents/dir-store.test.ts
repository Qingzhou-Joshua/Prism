import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DirAgentStore } from './dir-store.js'

describe('DirAgentStore', () => {
  let tmpDir: string
  let store: DirAgentStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'prism-agent-dir-test-'))
    store = new DirAgentStore(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('list returns empty array when directory is empty', async () => {
    const agents = await store.list()
    expect(agents).toEqual([])
  })

  it('list returns empty array when directory does not exist', async () => {
    const nonexistent = new DirAgentStore(join(tmpDir, 'no-such-dir'))
    const agents = await nonexistent.list()
    expect(agents).toEqual([])
  })

  it('list reads .md files and parses front matter', async () => {
    const content = `---
name: Code Reviewer
description: Reviews code for quality
---
Review the code.`
    await writeFile(join(tmpDir, 'code-reviewer.md'), content, 'utf-8')
    const agents = await store.list()
    expect(agents).toHaveLength(1)
    expect(agents[0].name).toBe('Code Reviewer')
    expect(agents[0].description).toBe('Reviews code for quality')
    expect(agents[0].id).toBeDefined()
  })

  it('list uses file name as agent name when front matter has no name', async () => {
    await writeFile(join(tmpDir, 'my-agent.md'), '# My Agent body', 'utf-8')
    const agents = await store.list()
    expect(agents).toHaveLength(1)
    expect(agents[0].name).toBe('my-agent')
  })

  it('list ignores non-.md files', async () => {
    await writeFile(join(tmpDir, 'note.txt'), 'ignored', 'utf-8')
    await writeFile(join(tmpDir, 'agent.md'), '# Agent', 'utf-8')
    const agents = await store.list()
    expect(agents).toHaveLength(1)
  })

  it('list returns stable ids across calls', async () => {
    await writeFile(join(tmpDir, 'stable-agent.md'), '# Stable', 'utf-8')
    const [first] = await store.list()
    const [second] = await store.list()
    expect(first.id).toBe(second.id)
  })

  it('get returns agent by id', async () => {
    await writeFile(join(tmpDir, 'fetch-agent.md'), '# Fetch Agent', 'utf-8')
    const [created] = await store.list()
    const found = await store.get(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('fetch-agent')
  })

  it('get returns null for unknown id', async () => {
    const result = await store.get('no-id')
    expect(result).toBeNull()
  })

  it('create writes a .md file and returns the agent', async () => {
    const agent = await store.create({
      name: 'New Agent',
      content: 'You are a helpful assistant.',
      description: 'A test agent',
    })
    expect(agent.id).toBeDefined()
    expect(agent.name).toBe('New Agent')
    expect(agent.content).toBe('You are a helpful assistant.')
    expect(agent.description).toBe('A test agent')
    expect(agent.tags).toEqual([])
    expect(agent.createdAt).toBeDefined()
    expect(agent.updatedAt).toBeDefined()
  })

  it('create file is discoverable by list', async () => {
    await store.create({ name: 'Listed Agent', content: 'body' })
    const agents = await store.list()
    expect(agents).toHaveLength(1)
  })

  it('update rewrites file with new content', async () => {
    const created = await store.create({ name: 'Old Agent', content: 'old body' })
    await new Promise((r) => setTimeout(r, 2))
    const updated = await store.update(created.id, { content: 'new body' })
    expect(updated).not.toBeNull()
    expect(updated!.content).toBe('new body')
    expect(updated!.updatedAt).not.toBe(created.updatedAt)
  })

  it('update returns null for unknown id', async () => {
    const result = await store.update('bad-id', { content: 'x' })
    expect(result).toBeNull()
  })

  it('delete removes file and returns true', async () => {
    const agent = await store.create({ name: 'Delete Me', content: 'x' })
    const result = await store.delete(agent.id)
    expect(result).toBe(true)
    expect(await store.list()).toHaveLength(0)
  })

  it('delete returns false for unknown id', async () => {
    const result = await store.delete('no-id')
    expect(result).toBe(false)
  })

  it('persists across store instances', async () => {
    const store1 = new DirAgentStore(tmpDir)
    const agent = await store1.create({ name: 'Persist Agent', content: 'body' })
    const store2 = new DirAgentStore(tmpDir)
    const found = await store2.get(agent.id)
    expect(found).not.toBeNull()
    expect(found!.content).toBe('body')
  })

  it('importAgents skips already-existing names', async () => {
    await store.create({ name: 'Existing Agent', content: 'x' })
    const result = await store.importAgents([
      { fileName: 'existing-agent.md', content: '# Existing Agent' },
      { fileName: 'new-agent.md', content: '# New Agent' },
    ])
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
