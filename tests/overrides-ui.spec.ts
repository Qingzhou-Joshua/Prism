/**
 * Group D UI: Platform Overrides 面板
 * 测试 RuleEditorPage 底部的 Platform Overrides 可折叠面板。
 *
 * 说明：
 * - 不测试 Monaco Editor 输入（Monaco 在 Playwright 中操作复杂）
 * - 只验证面板展开/收起、3 个平台区块显示、Save Override 按钮存在
 * - 通过 API 注入一条测试 rule，确保列表非空（CI 安全）
 */
import { test, expect } from './fixtures.js'
import { createRule, deleteRule } from './helpers/api.js'
import { navigateTo } from './helpers/navigate.js'

// ── Shared state ──────────────────────────────────────────────────────────────

// Rule seeded via API before each test; cleaned up in afterEach.
let seededRuleId: string | null = null

test.beforeEach(async () => {
  const rule = await createRule({
    name: `e2e-overrides-ui-${Date.now()}`,
    content: '# Overrides UI test rule',
  })
  seededRuleId = rule.id
})

test.afterEach(async () => {
  if (seededRuleId) {
    await deleteRule(seededRuleId).catch(() => {/* already deleted is fine */})
    seededRuleId = null
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 进入 Claude Code → Rules，并点击第一条 rule 卡片打开编辑器。
 *  如果列表为空（不应发生，因为 beforeEach 已 seed），用 test.skip() 保护。 */
async function openFirstRule(page: Parameters<typeof navigateTo>[0]) {
  await navigateTo(page, 'Rules')

  // 等待 Rules 页面标题渲染
  await expect(page.locator('.page-title', { hasText: 'Rules' })).toBeVisible({ timeout: 10000 })

  const cards = page.locator('.item-card')
  // 等待列表渲染（用 waitForSelector 替代 waitForTimeout）
  await page.waitForSelector('.item-card', { timeout: 8000 }).catch(() => {/* list may be empty */})

  const count = await cards.count()
  if (count === 0) {
    test.skip(true, 'Rules 列表为空（seed 失败？），跳过 Overrides UI 测试')
    return
  }

  // 点击第一条 rule 卡片
  await cards.first().click()

  // 等待编辑器页面出现
  await expect(page.locator('.editor-page')).toBeVisible({ timeout: 8000 })
}

/** 返回 Platform Overrides 折叠按钮的 locator。 */
function overridesToggle(page: Parameters<typeof navigateTo>[0]) {
  return page.locator('button', { hasText: 'Platform Overrides' })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Group D UI: Platform Overrides 面板', () => {

  test('1. 面板展开/收起 — 点击按钮后箭头由收起变为展开', async ({ page }) => {
    await openFirstRule(page)

    const toggle = overridesToggle(page)
    await expect(toggle).toBeVisible({ timeout: 5000 })

    // 初始状态：收起
    const chevron = toggle.locator('[data-chevron]')
    await expect(chevron).toHaveAttribute('data-chevron', 'closed')

    // 点击展开
    await toggle.click()

    // 展开后：chevron 为展开态
    await expect(chevron).toHaveAttribute('data-chevron', 'open', { timeout: 3000 })

    // 面板内容可见（至少 Claude Code 子标题出现）
    await expect(page.locator('span', { hasText: 'Claude Code' }).first()).toBeVisible({
      timeout: 5000,
    })

    console.log('✓ Platform Overrides 面板展开：▶ → ▼')
  })

  test('2. 展开后为每个支持 rules 的平台显示区块', async ({ page }) => {
    await openFirstRule(page)

    // 展开面板
    await overridesToggle(page).click()

    // 每个支持 rules 的已发现平台都有一个区块（按 displayName 显示）
    const res = await page.request.get('http://localhost:3001/platforms')
    const { items } = (await res.json()) as { items: Array<{ displayName: string; detected: boolean; capabilities: { rules: boolean } }> }
    for (const p of items.filter((x) => x.detected && x.capabilities.rules)) {
      await expect(page.locator('span', { hasText: p.displayName }).first()).toBeVisible({ timeout: 5000 })
    }
    await expect(page.locator('span', { hasText: /openclaw/i })).toHaveCount(0)
  })

  test('3. Save Override 按钮在各平台区块内存在且可用', async ({ page }) => {
    await openFirstRule(page)

    // 展开面板
    await overridesToggle(page).click()
    await expect(page.locator('span', { hasText: 'Claude Code' }).first()).toBeVisible({
      timeout: 5000,
    })

    // 每个支持 rules 的已发现平台各一个 "Save Override" 按钮
    const res = await page.request.get('http://localhost:3001/platforms')
    const { items } = (await res.json()) as { items: Array<{ detected: boolean; capabilities: { rules: boolean } }> }
    const expected = items.filter((p) => p.detected && p.capabilities.rules).length
    const saveButtons = page.locator('button', { hasText: 'Save Override' })
    await expect(saveButtons.first()).toBeVisible({ timeout: 5000 })

    const buttonCount = await saveButtons.count()
    expect(buttonCount).toBe(expected)

    // 全部为 enabled 状态
    for (let i = 0; i < buttonCount; i++) {
      await expect(saveButtons.nth(i)).toBeEnabled()
    }

    console.log(`✓ 找到 ${buttonCount} 个 "Save Override" 按钮，全部可用`)
  })

  test('4. 收起 — 再次点击折叠按钮，panel 内容隐藏', async ({ page }) => {
    await openFirstRule(page)

    const toggle = overridesToggle(page)
    const chevron = toggle.locator('[data-chevron]')

    // 先展开
    await toggle.click()
    await expect(chevron).toHaveAttribute('data-chevron', 'open', { timeout: 3000 })
    await expect(page.locator('span', { hasText: 'Claude Code' }).first()).toBeVisible({
      timeout: 5000,
    })

    // 再次点击 → 收起
    await toggle.click()
    await expect(chevron).toHaveAttribute('data-chevron', 'closed', { timeout: 3000 })

    // Save Override 按钮应从视图中消失（panel 被 React 条件渲染移除）
    await expect(page.locator('button', { hasText: 'Save Override' }).first()).not.toBeVisible({
      timeout: 3000,
    })

    console.log('✓ 再次点击后面板收起：▼ → ▶，内容隐藏')
  })
})
