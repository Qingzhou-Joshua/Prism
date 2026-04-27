import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DirRuleStore } from '@prism/core'
import { registerRulesRoutes } from './rules.js'
import type { UnifiedRule } from '@prism/shared'

async function buildApp(storeDir: string) {
  const app = Fastify()
  const store = new DirRuleStore(storeDir)
  const stores = new Map([['claude-code', store]])
  await registerRulesRoutes(app, stores)
  return app
}

describe('Rules API', () => {
  let tmpDir: string
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'prism-api-test-'))
    app = await buildApp(tmpDir)
  })

  afterEach(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('GET /rules returns empty array initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/rules' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ items: [] })
  })

  it('POST /rules creates a rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rules',
      payload: {
        name: 'No console.log',
        content: 'Do not use console.log in production code.',
        scope: 'global',
        platformOverrides: {},
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as UnifiedRule
    expect(body.id).toBeTruthy()
    expect(body.name).toBe('No console.log')
  })

  it('GET /rules/:id returns the rule', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/rules',
      payload: {
        name: 'Rule A',
        content: 'Content A',
        scope: 'global',
        platformOverrides: {},
      },
    })
    const { id } = created.json() as UnifiedRule
    const res = await app.inject({ method: 'GET', url: `/rules/${id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json<UnifiedRule>().name).toBe('Rule A')
  })

  it('GET /rules/:id returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/rules/no-such-id' })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /rules/:id updates the rule', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/rules',
      payload: { name: 'Old', content: 'Old content', scope: 'global', platformOverrides: {} },
    })
    const { id } = created.json() as UnifiedRule
    const res = await app.inject({
      method: 'PUT',
      url: `/rules/${id}`,
      payload: { name: 'New Name' },
    })
    expect(res.statusCode).toBe(200)
    const updated = res.json<UnifiedRule>()
    expect(updated.name).toBe('New Name')
    expect(updated.content).toBe('Old content')  // 未修改的字段应保持不变
    expect(updated.scope).toBe('global')
  })

  it('PUT /rules/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/rules/no-such-id',
      payload: { name: 'X' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'Rule not found' })
  })

  it('DELETE /rules/:id removes the rule', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/rules',
      payload: { name: 'To Delete', content: 'x', scope: 'global', platformOverrides: {} },
    })
    const { id } = created.json() as UnifiedRule
    const del = await app.inject({ method: 'DELETE', url: `/rules/${id}` })
    expect(del.statusCode).toBe(204)
    const get = await app.inject({ method: 'GET', url: `/rules/${id}` })
    expect(get.statusCode).toBe(404)
  })

  it('DELETE /rules/:id returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/rules/no-such-id' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'Rule not found' })
  })

  it('GET /rules/:id/projections returns per-platform projections', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/rules',
      payload: {
        name: 'Proj Rule',
        content: 'Default',
        scope: 'global',
        platformOverrides: { codebuddy: { content: 'CodeBuddy specific' } },
      },
    })
    const { id } = created.json() as UnifiedRule
    const res = await app.inject({ method: 'GET', url: `/rules/${id}/projections` })
    expect(res.statusCode).toBe(200)
    const { projections } = res.json<{ projections: Array<{ platformId: string; content: string | null }> }>()
    const cbProj = projections.find(p => p.platformId === 'codebuddy')
    expect(cbProj?.content).toBe('CodeBuddy specific')
  })
})
