import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DirSkillStore } from '@prism/core'
import { registerSkillsRoutes } from './skills.js'
import type { UnifiedSkill } from '@prism/shared'

async function buildApp(storeDir: string) {
  const app = Fastify()
  const store = new DirSkillStore(storeDir)
  await registerSkillsRoutes(app, store)
  return app
}

describe('Skills API', () => {
  let tmpDir: string
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'prism-skills-api-test-'))
    app = await buildApp(tmpDir)
  })

  afterEach(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('GET /skills returns empty array initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ items: [] })
  })

  it('POST /skills creates a skill', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'deploy',
        content: 'Deploy the application to production.',
        tags: ['deployment'],
        targetPlatforms: ['claude-code'],
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as UnifiedSkill
    expect(body.id).toBeTruthy()
    expect(body.name).toBe('deploy')
  })

  it('GET /skills/:id returns the skill', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'Skill A',
        content: 'Content A',
        tags: [],
        targetPlatforms: ['claude-code'],
      },
    })
    const { id } = created.json() as UnifiedSkill
    const res = await app.inject({ method: 'GET', url: `/skills/${id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json<UnifiedSkill>().name).toBe('Skill A')
  })

  it('GET /skills/:id returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills/no-such-id' })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /skills/:id updates the skill', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'Old Skill',
        content: 'Old content',
        tags: [],
        targetPlatforms: ['claude-code'],
      },
    })
    const { id } = created.json() as UnifiedSkill
    const res = await app.inject({
      method: 'PUT',
      url: `/skills/${id}`,
      payload: { name: 'New Skill Name' },
    })
    expect(res.statusCode).toBe(200)
    const updated = res.json<UnifiedSkill>()
    expect(updated.name).toBe('New Skill Name')
    expect(updated.content).toBe('Old content') // 未修改的字段应保持不变
  })

  it('PUT /skills/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/skills/no-such-id',
      payload: { name: 'X' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'Skill not found' })
  })

  it('DELETE /skills/:id removes the skill', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'To Delete',
        content: 'x',
        tags: [],
        targetPlatforms: ['claude-code'],
      },
    })
    const { id } = created.json() as UnifiedSkill
    const del = await app.inject({ method: 'DELETE', url: `/skills/${id}` })
    expect(del.statusCode).toBe(204)
    const get = await app.inject({ method: 'GET', url: `/skills/${id}` })
    expect(get.statusCode).toBe(404)
  })

  it('DELETE /skills/:id returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/skills/no-such-id' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'Skill not found' })
  })

  it('GET /skills/:id/projections returns per-platform projections', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'my-skill',
        content: '# My Skill\n\nThis is my skill content.',
        tags: ['test'],
        targetPlatforms: ['claude-code', 'codebuddy'],
      },
    })
    const { id } = created.json() as UnifiedSkill
    const res = await app.inject({ method: 'GET', url: `/skills/${id}/projections` })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ projections: Array<{ platformId: string; fileName: string; content: string }> }>()
    expect(body.projections).toBeDefined()
    expect(Array.isArray(body.projections)).toBe(true)
    // claude-code and codebuddy support skills
    const claudeProj = body.projections.find(p => p.platformId === 'claude-code')
    expect(claudeProj).toBeDefined()
    expect(claudeProj!.fileName).toBe('my-skill')
    expect(claudeProj!.content).toBe('# My Skill\n\nThis is my skill content.')
    expect(body.projections.find(p => p.platformId === 'codebuddy')).toBeDefined()
  })

  it('GET /skills/:id/projections returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills/no-such-id/projections' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'Skill not found' })
  })
})
