import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FileAgentStore } from './store.js'
import type { CreateAgentDto, ImportedAgent } from '@prism/shared'

let tmpDir: string
let store: FileAgentStore

const baseDto: CreateAgentDto = {
  name: 'Test Agent',
  description: 'A test agent',
  content: '# Test\nYou are a test agent.',
  tools: ['Bash', 'Read'],
  model: 'sonnet',
  tags: ['test'],
  targetPlatforms: ['claude-code'],
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'prism-agents-test-'))
  store = new FileAgentStore(join(tmpDir, 'agents.json'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('FileAgentStore', () => {
  it('returns empty array when file does not exist', async () => {
    const agents = await store.list()
    expect(agents).toEqual([])
  })

  it('creates an agent with id and timestamps', async () => {
    const agent = await store.create(baseDto)
    expect(agent.id).toBeTruthy()
    expect(agent.name).toBe('Test Agent')
    expect(agent.tools).toEqual(['Bash', 'Read'])
    expect(agent.model).toBe('sonnet')
    expect(agent.tags).toEqual(['test'])
    expect(agent.createdAt).toBeTruthy()
    expect(agent.updatedAt).toBeTruthy()
  })

  it('defaults tags to empty array', async () => {
    const { tags: _tags, ...dtoWithoutTags } = baseDto
    const agent = await store.create(dtoWithoutTags as CreateAgentDto)
    expect(agent.tags).toEqual([])
  })

  it('lists all created agents', async () => {
    await store.create(baseDto)
    await store.create({ ...baseDto, name: 'Second Agent' })
    const agents = await store.list()
    expect(agents).toHaveLength(2)
  })

  it('gets agent by id', async () => {
    const created = await store.create(baseDto)
    const found = await store.get(created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('returns null for unknown id', async () => {
    const found = await store.get('does-not-exist')
    expect(found).toBeNull()
  })

  it('updates agent fields and updatedAt', async () => {
    const created = await store.create(baseDto)
    const originalUpdatedAt = created.updatedAt

    await new Promise(r => setTimeout(r, 10))

    const updated = await store.update(created.id, { name: 'Updated Name', model: 'opus' })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('Updated Name')
    expect(updated!.model).toBe('opus')
    expect(updated!.updatedAt).not.toBe(originalUpdatedAt)
    expect(updated!.createdAt).toBe(created.createdAt)
  })

  it('returns null when updating non-existent id', async () => {
    const result = await store.update('no-such-id', { name: 'X' })
    expect(result).toBeNull()
  })

  it('deletes existing agent and returns true', async () => {
    const created = await store.create(baseDto)
    const result = await store.delete(created.id)
    expect(result).toBe(true)
    expect(await store.get(created.id)).toBeNull()
  })

  it('returns false when deleting non-existent id', async () => {
    const result = await store.delete('no-such-id')
    expect(result).toBe(false)
  })

  it('persists data across store instances', async () => {
    const created = await store.create(baseDto)

    const store2 = new FileAgentStore(join(tmpDir, 'agents.json'))
    const found = await store2.get(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Test Agent')
  })

  it('serializes concurrent writes', async () => {
    // Fire 5 concurrent creates and verify all are persisted
    await Promise.all([
      store.create({ name: 'Agent 1', content: 'c1', tags: [], targetPlatforms: [] }),
      store.create({ name: 'Agent 2', content: 'c2', tags: [], targetPlatforms: [] }),
      store.create({ name: 'Agent 3', content: 'c3', tags: [], targetPlatforms: [] }),
      store.create({ name: 'Agent 4', content: 'c4', tags: [], targetPlatforms: [] }),
      store.create({ name: 'Agent 5', content: 'c5', tags: [], targetPlatforms: [] }),
    ])
    const agents = await store.list()
    expect(agents).toHaveLength(5)
  })

  describe('importAgents', () => {
    it('imports new agents from ImportedAgent list', async () => {
      const imported: ImportedAgent[] = [
        { fileName: 'planner.md', content: '---\nname: Planner\ndescription: Plans stuff\n---\nYou are a planner.' },
        { fileName: 'reviewer.md', content: '# Reviewer\nYou review code.' },
      ]

      const result = await store.importAgents(imported)
      expect(result.imported).toBe(2)
      expect(result.skipped).toBe(0)

      const agents = await store.list()
      expect(agents).toHaveLength(2)
      expect(agents.map(a => a.name).sort()).toEqual(['Planner', 'reviewer'])
    })

    it('skips agents whose name already exists', async () => {
      await store.create(baseDto) // name: 'Test Agent'

      const imported: ImportedAgent[] = [
        { fileName: 'test-agent.md', content: '---\nname: Test Agent\n---\nDuplicate.' },
        { fileName: 'new-agent.md', content: 'New agent content.' },
      ]

      const result = await store.importAgents(imported)
      expect(result.imported).toBe(1)
      expect(result.skipped).toBe(1)

      const agents = await store.list()
      expect(agents).toHaveLength(2)
    })

    it('skips duplicates case-insensitively', async () => {
      await store.create({ ...baseDto, name: 'Planner' })

      const imported: ImportedAgent[] = [
        { fileName: 'planner.md', content: '---\nname: planner\n---\nDuplicate.' },
      ]

      const result = await store.importAgents(imported)
      expect(result.imported).toBe(0)
      expect(result.skipped).toBe(1)
    })

    it('importAgents: preserves tools and model fields', async () => {
      const imported: ImportedAgent[] = [
        {
          fileName: 'build-fixer.md',
          content: '---\nname: Build Fixer\nmodel: opus\ntools:\n  - Bash\n  - Read\n---\nFix build errors.',
        },
      ]
      const result = await store.importAgents(imported)
      expect(result.imported).toBe(1)
      const agents = await store.list()
      expect(agents[0].tools).toEqual(['Bash', 'Read'])
      expect(agents[0].model).toBe('opus')
    })
  })
})
