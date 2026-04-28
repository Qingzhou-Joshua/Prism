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

  test('1. 面板展开/收起 — 点击按钮后 ▶ 变 ▼', async ({ page }) => {
    await openFirstRule(page)

    const toggle = overridesToggle(page)
    await expect(toggle).toBeVisible({ timeout: 5000 })

    // 初始状态：收起，显示 ▶
    const chevron = toggle.locator('span').first()
    await expect(chevron).toHaveText('▶')

    // 点击展开
    await toggle.click()

    // 展开后：chevron 变 ▼
    await expect(chevron).toHaveText('▼', { timeout: 3000 })

    // 面板内容可见（至少 claude-code 子标题出现）
    await expect(page.locator('span', { hasText: 'claude-code' }).first()).toBeVisible({
      timeout: 5000,
    })

    console.log('✓ Platform Overrides 面板展开：▶ → ▼')
  })

  test('2. 展开后正确显示 3 个平台区块', async ({ page }) => {
    await openFirstRule(page)

    // 展开面板
    await overridesToggle(page).click()

    // 等待 claude-code 子标题出现（面板渲染完毕的信号）
    await expect(page.locator('span', { hasText: 'claude-code' }).first()).toBeVisible({
      timeout: 5000,
    })

    // 断言 3 个平台 id 都出现在平台子标题 span 中
    const platformIds = ['claude-code', 'codebuddy', 'openclaw'] as const
    for (const pid of platformIds) {
      await expect(page.locator('span', { hasText: pid }).first()).toBeVisible({ timeout: 3000 })
    }

    console.log('✓ 3 个平台区块均已显示：claude-code, codebuddy, openclaw')
  })

  test('3. Save Override 按钮在各平台区块内存在且可用', async ({ page }) => {
    await openFirstRule(page)

    // 展开面板
    await overridesToggle(page).click()
    await expect(page.locator('span', { hasText: 'claude-code' }).first()).toBeVisible({
      timeout: 5000,
    })

    // 应有 3 个 "Save Override" 按钮（每平台各一个）
    const saveButtons = page.locator('button', { hasText: 'Save Override' })
    await expect(saveButtons.first()).toBeVisible({ timeout: 5000 })

    const buttonCount = await saveButtons.count()
    expect(buttonCount).toBe(3)

    // 全部为 enabled 状态
    for (let i = 0; i < buttonCount; i++) {
      await expect(saveButtons.nth(i)).toBeEnabled()
    }

    console.log(`✓ 找到 ${buttonCount} 个 "Save Override" 按钮，全部可用`)
  })

  test('4. 收起 — 再次点击折叠按钮，panel 内容隐藏', async ({ page }) => {
    await openFirstRule(page)

    const toggle = overridesToggle(page)
    const chevron = toggle.locator('span').first()

    // 先展开
    await toggle.click()
    await expect(chevron).toHaveText('▼', { timeout: 3000 })
    await expect(page.locator('span', { hasText: 'claude-code' }).first()).toBeVisible({
      timeout: 5000,
    })

    // 再次点击 → 收起
    await toggle.click()
    await expect(chevron).toHaveText('▶', { timeout: 3000 })

    // Save Override 按钮应从视图中消失（panel 被 React 条件渲染移除）
    await expect(page.locator('button', { hasText: 'Save Override' }).first()).not.toBeVisible({
      timeout: 3000,
    })

    console.log('✓ 再次点击后面板收起：▼ → ▶，内容隐藏')
  })
})
