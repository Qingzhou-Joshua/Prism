/**
 * Group D API: Override CRUD
 * 纯 API 测试，不需要 page fixture。
 * 直接调用 Fastify server (:3001)。
 */
import { test, expect } from '@playwright/test'
import { setOverride, deleteOverride } from './helpers/api.js'

const API_BASE = 'http://localhost:3001'

// ── 低层 fetch 辅助（保留原始 Response，便于断言 status code） ─────────────────

async function getOverride(platformId: string, assetType: string, id: string) {
  return fetch(`${API_BASE}/overrides/${platformId}/${assetType}/${id}`)
}

async function putOverride(
  platformId: string,
  assetType: string,
  id: string,
  content: string,
) {
  return fetch(`${API_BASE}/overrides/${platformId}/${assetType}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

async function delOverride(platformId: string, assetType: string, id: string) {
  return fetch(`${API_BASE}/overrides/${platformId}/${assetType}/${id}`, {
    method: 'DELETE',
  })
}

async function listOverrides(platformId: string, assetType: string) {
  return fetch(`${API_BASE}/overrides/${platformId}/${assetType}`)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Group D API: Override CRUD', () => {

  test('1. GET 不存在的 override → 404', async () => {
    const id = `e2e-override-nonexistent-${Date.now()}`
    const res = await getOverride('claude-code', 'rule', id)
    expect(res.status).toBe(404)
  })

  test('2. PUT 新建 override → 200，返回 { content }', async () => {
    const id = `e2e-override-create-${Date.now()}`
    const content = '# Override content created in E2E test'

    try {
      const res = await putOverride('claude-code', 'rule', id, content)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body).toHaveProperty('content', content)
    } finally {
      await deleteOverride('claude-code', 'rule', id).catch(() => {/* 容忍 404 */})
    }
  })

  test('3. GET 刚创建的 override → 200，content 与 PUT 的一致', async () => {
    const id = `e2e-override-get-${Date.now()}`
    const content = '# Read-back test content'

    try {
      await setOverride('claude-code', 'rule', id, content)

      const res = await getOverride('claude-code', 'rule', id)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body).toHaveProperty('content', content)
    } finally {
      await deleteOverride('claude-code', 'rule', id).catch(() => {/* 容忍 404 */})
    }
  })

  test('4. PUT 更新 override → 200，content 已更新', async () => {
    const id = `e2e-override-update-${Date.now()}`
    const original = '# Original content'
    const updated = '# Updated content — v2'

    try {
      // 先建
      await setOverride('claude-code', 'rule', id, original)

      // 再更新
      const putRes = await putOverride('claude-code', 'rule', id, updated)
      expect(putRes.status).toBe(200)

      // 读回确认 content 已替换
      const getRes = await getOverride('claude-code', 'rule', id)
      expect(getRes.status).toBe(200)
      const body = await getRes.json()
      expect(body.content).toBe(updated)
    } finally {
      await deleteOverride('claude-code', 'rule', id).catch(() => {/* 容忍 404 */})
    }
  })

  test('5. DELETE override → 204', async () => {
    const id = `e2e-override-delete-${Date.now()}`
    await setOverride('claude-code', 'rule', id, '# To be deleted')

    try {
      const res = await delOverride('claude-code', 'rule', id)
      expect(res.status).toBe(204)
    } catch (err) {
      // 确保 DELETE 失败时也清理
      await deleteOverride('claude-code', 'rule', id).catch(() => {/* 容忍 404 */})
      throw err
    }
  })

  test('6. GET 已删除的 override → 404', async () => {
    const id = `e2e-override-deleted-${Date.now()}`

    // 建立后立即删除
    await setOverride('claude-code', 'rule', id, '# Ephemeral')
    await delOverride('claude-code', 'rule', id)

    // 再 GET 应该 404
    const res = await getOverride('claude-code', 'rule', id)
    expect(res.status).toBe(404)
  })

  test('7. GET /overrides/:platformId/:assetType (list) → 包含已 PUT 的 id', async () => {
    const id = `e2e-override-list-${Date.now()}`

    try {
      await setOverride('codebuddy', 'skill', id, '# List test')

      const res = await listOverrides('codebuddy', 'skill')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body).toHaveProperty('items')
      expect(Array.isArray(body.items)).toBe(true)
      // items 是对象数组 [{id, content}]，提取 id 字段后再断言包含目标 id
      const itemIds = body.items.map((item: { id: string }) => item.id)
      expect(itemIds).toContain(id)
    } finally {
      await deleteOverride('codebuddy', 'skill', id).catch(() => {/* 容忍 404 */})
    }
  })

  test('8. 无效 platformId → 400', async () => {
    const res = await getOverride('bad-platform', 'rule', 'any-id')
    expect(res.status).toBe(400)
  })

  test('9. 无效 assetType → 400（"command" 不在有效列表中）', async () => {
    const res = await getOverride('claude-code', 'command', 'any-id')
    expect(res.status).toBe(400)
  })
})
