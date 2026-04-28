/**
 * Registry API E2E tests
 *
 * 全部为 API 级别测试，直接调用 Fastify :3001，不启动浏览器 page。
 * 每个 test 开头先 resetRegistry() 保证状态隔离，测试间完全独立。
 *
 * CI 安全性：scan 前先用 createRule() 注入测试数据，不依赖文件系统已有资产。
 */

import { test, expect } from './fixtures.js'
import {
  API_BASE,
  resetRegistry,
  scanRegistry,
  getRegistry,
  getConflicts,
  createRule,
  deleteRule,
} from './helpers/api.js'

/** Seed a minimal rule and return its id for cleanup. */
async function seedRule(): Promise<string> {
  const rule = await createRule({ name: 'e2e-registry-seed', content: '# E2E seed rule for registry tests' })
  return rule.id
}

// ─────────────────────────────────────────────
// 1. DELETE /registry → 204
// ─────────────────────────────────────────────
test('DELETE /registry 返回 204', async () => {
  const res = await fetch(`${API_BASE}/registry`, { method: 'DELETE' })
  expect(res.status, `期望 204，实际收到 ${res.status}`).toBe(204)
  console.log('✓ DELETE /registry 返回 204')
})

// ─────────────────────────────────────────────
// 2. POST /registry/scan → indexed > 0
// ─────────────────────────────────────────────
test('POST /registry/scan 扫描后 indexed 为正数', async () => {
  await resetRegistry()
  const seededId = await seedRule()

  try {
    const result = await scanRegistry()

    expect(result, '响应体缺少 indexed 字段').toHaveProperty('indexed')
    expect(result, '响应体缺少 errors 字段').toHaveProperty('errors')
    expect(result, '响应体缺少 scannedAt 字段').toHaveProperty('scannedAt')
    expect(result.indexed, `indexed 应 > 0（已注入种子 rule），实际 ${result.indexed}`).toBeGreaterThan(0)
    expect(Array.isArray(result.errors), 'errors 应为数组').toBe(true)
    expect(result.scannedAt, 'scannedAt 应为非空字符串').toBeTruthy()

    console.log(`✓ POST /registry/scan 返回 indexed=${result.indexed}, errors=${result.errors.length}`)
  } finally {
    await deleteRule(seededId).catch(() => {/* ignore */})
  }
})

// ─────────────────────────────────────────────
// 3. GET /registry → entries 数组非空
// ─────────────────────────────────────────────
test('GET /registry 扫描后 entries 不为空', async () => {
  await resetRegistry()
  const seededId = await seedRule()

  try {
    await scanRegistry()

    const registry = await getRegistry()

    expect(registry, '响应体缺少 entries 字段').toHaveProperty('entries')
    expect(Array.isArray(registry.entries), 'entries 应为数组').toBe(true)
    expect(registry.entries.length, `entries 不应为空，实际长度 ${registry.entries.length}`).toBeGreaterThan(0)

    console.log(`✓ GET /registry 返回 ${registry.entries.length} 条 entries`)
  } finally {
    await deleteRule(seededId).catch(() => {/* ignore */})
  }
})

// ─────────────────────────────────────────────
// 4. entries 字段完整性
// ─────────────────────────────────────────────
test('RegistryEntry 包含所有必需字段', async () => {
  await resetRegistry()
  const seededId = await seedRule()

  try {
    await scanRegistry()

    const registry = await getRegistry()
    expect(registry.entries.length, '至少需要一条 entry 才能验证字段结构').toBeGreaterThan(0)

    const entry = registry.entries[0] as Record<string, unknown>
    const requiredFields = [
      'id',
      'name',
      'type',
      'platformId',
      'filePath',
      'checksum',
      'createdAt',
      'updatedAt',
      'indexedAt',
    ]

    for (const field of requiredFields) {
      expect(entry, `entry 缺少字段: ${field}`).toHaveProperty(field)
      expect(entry[field], `entry.${field} 不应为 null/undefined/空`).toBeTruthy()
    }

    console.log(
      `✓ RegistryEntry 字段完整：id=${entry['id']}, type=${entry['type']}, platformId=${entry['platformId']}`,
    )
  } finally {
    await deleteRule(seededId).catch(() => {/* ignore */})
  }
})

// ─────────────────────────────────────────────
// 5. scan 幂等性 — 连续两次 indexed 应相同
// ─────────────────────────────────────────────
test('连续两次 scan indexed 数量相同（upsert 语义）', async () => {
  await resetRegistry()
  const seededId = await seedRule()

  try {
    const first = await scanRegistry()
    const second = await scanRegistry()

    expect(first.indexed, '第一次 scan indexed 应 > 0').toBeGreaterThan(0)
    expect(
      second.indexed,
      `第二次 scan indexed 应与第一次相同：期望 ${first.indexed}，实际 ${second.indexed}`,
    ).toBe(first.indexed)

    console.log(`✓ scan 幂等性通过：两次均返回 indexed=${first.indexed}`)
  } finally {
    await deleteRule(seededId).catch(() => {/* ignore */})
  }
})

// ─────────────────────────────────────────────
// 6. DELETE /registry 后 GET → entries = []
// ─────────────────────────────────────────────
test('DELETE /registry 后 GET /registry 返回空 entries', async () => {
  await resetRegistry()
  const seededId = await seedRule()

  // 先扫描确保有数据
  const { indexed } = await scanRegistry()
  expect(indexed, '前置条件：扫描后 indexed 应 > 0').toBeGreaterThan(0)

  // reset 后验证已清空（同时也清掉了 seededId，无需额外 deleteRule）
  await resetRegistry()
  const registry = await getRegistry()

  expect(Array.isArray(registry.entries), 'entries 应为数组').toBe(true)
  expect(registry.entries.length, `reset 后 entries 应为空，实际长度 ${registry.entries.length}`).toBe(0)

  // 清理磁盘上的 rule 文件（registry 已 reset，但文件本身还在）
  await deleteRule(seededId).catch(() => {/* ignore */})

  console.log('✓ DELETE /registry 后 GET /registry 返回 entries=[]')
})

// ─────────────────────────────────────────────
// 7. reset 后 GET /registry/conflicts → conflicts = []
// ─────────────────────────────────────────────
test('GET /registry/conflicts 在 registry 为空时返回空数组', async () => {
  await resetRegistry()

  const { conflicts } = await getConflicts()

  expect(Array.isArray(conflicts), 'conflicts 应为数组').toBe(true)
  expect(conflicts.length, `空 registry 不应存在 conflict，实际 ${conflicts.length} 条`).toBe(0)

  console.log('✓ registry 清空后 GET /registry/conflicts 返回 conflicts=[]')
})

// ─────────────────────────────────────────────
// 8. 重复 scan 不产生假冲突（upsert 复合 key 验证）
// ─────────────────────────────────────────────
test('重复 scan 同一数据不产生假冲突', async () => {
  await resetRegistry()
  const seededId = await seedRule()

  try {
    // 第一次 scan，记录初始 conflict 数量
    await scanRegistry()
    const { conflicts: conflictsAfterFirst } = await getConflicts()
    const countAfterFirst = conflictsAfterFirst.length

    // 第二次 scan（相同数据，upsert 以 id+platformId 为复合 key，不新增重复条目）
    await scanRegistry()
    const { conflicts: conflictsAfterSecond } = await getConflicts()
    const countAfterSecond = conflictsAfterSecond.length

    expect(
      countAfterSecond,
      `第二次 scan 不应增加 conflict：第一次 ${countAfterFirst}，第二次 ${countAfterSecond}`,
    ).toBe(countAfterFirst)

    console.log(
      `✓ upsert 幂等：两次 scan 后 conflicts 数量一致（${countAfterSecond} 条），无假冲突`,
    )
  } finally {
    await deleteRule(seededId).catch(() => {/* ignore */})
  }
})
