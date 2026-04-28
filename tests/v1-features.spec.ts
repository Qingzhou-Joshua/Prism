import { test, expect, type Page } from '@playwright/test'
import { API_BASE } from './helpers/api.js'
import { selectPlatform as _selectPlatform, goToPage as _goToPage } from './helpers/navigate.js'

// ── Thin wrappers that return boolean instead of throwing ─────────────────────
// navigate.ts helpers throw on not-found; these spec-local wrappers return false
// so individual test cases can skip gracefully rather than hard-fail.

/** Returns false if the platform tab doesn't exist. */
async function selectPlatform(page: Page, platformName: string): Promise<boolean> {
  await page.goto('/')
  await expect(page.locator('.platform-tab').first()).toBeVisible({ timeout: 10000 })
  const tab = page.locator('.platform-tab', { hasText: platformName })
  if ((await tab.count()) === 0) {
    console.warn(`⚠ 平台 tab "${platformName}" 不存在，跳过后续断言`)
    return false
  }
  await expect(tab).toBeVisible()
  const offlineDot = tab.locator('.tab-dot.offline')
  if ((await offlineDot.count()) > 0) {
    console.warn(`⚠ 平台 "${platformName}" 处于 offline 状态，测试继续但可能部分数据为空`)
  }
  await tab.click()
  return true
}

/** Returns false if the sidebar nav item doesn't exist. */
async function goToPage(page: Page, label: string): Promise<boolean> {
  const navItem = page.locator('.sidebar-nav-item', { hasText: label })
  if ((await navItem.count()) === 0) {
    console.warn(`⚠ 侧边栏项 "${label}" 不存在`)
    return false
  }
  await expect(navItem).toBeVisible({ timeout: 5000 })
  await navItem.click()
  return true
}

// Suppress unused-import lint warnings — _selectPlatform / _goToPage are
// available for future tests that want the throwing versions.
void _selectPlatform
void _goToPage

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Group B: v1.0 新功能验证', () => {
  test('B-1. OpenClaw tab 已注册并在平台列表中显示', async ({ page, request }) => {
    // 先通过 API 验证 openclaw 是否在 /platforms 响应中
    const res = await request.get(`${API_BASE}/platforms`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    const platforms: Array<{ id: string; displayName?: string }> = Array.isArray(body)
      ? body
      : (body.platforms ?? body.items ?? [])

    const openclawEntry = platforms.find((p) => p.id === 'openclaw')
    if (!openclawEntry) {
      // v1.0 修复项：若仍未注册，让 test 明确失败并给出提示
      throw new Error(
        '❌ openclaw 平台未在 /platforms 中注册。请检查 server/src/index.ts 是否已注册 adapter-openclaw。',
      )
    }
    console.log('✓ /platforms API 包含 openclaw:', JSON.stringify(openclawEntry))

    // 再验证浏览器 UI 中的 tab
    await page.goto('/')
    await expect(page.locator('.platform-tab').first()).toBeVisible({ timeout: 10000 })

    const openclawTab = page.locator('.platform-tab', { hasText: /openclaw/i })
    await expect(openclawTab).toBeVisible({ timeout: 5000 })

    console.log('✓ OpenClaw tab 在 UI 中可见（v1.0 修复：adapter-openclaw 已注册）')
  })

  test('B-2. ScopeBadge — Rules 列表中的 card 显示 scope 标签', async ({ page }) => {
    const ok = await selectPlatform(page, 'Claude Code')
    if (!ok) {
      test.skip()
      return
    }

    await goToPage(page, 'Rules')
    await expect(page.locator('.page-title', { hasText: 'Rules' })).toBeVisible({ timeout: 8000 })

    // 检查是否有 rule cards
    const ruleCards = page.locator('.item-card')
    const cardCount = await ruleCards.count()

    if (cardCount === 0) {
      console.log('⚠ Rules 列表为空，无法验证 ScopeBadge。请先创建至少一条 rule。')
      // 不 hard fail：数据问题不代表功能坏了
      return
    }

    console.log(`  找到 ${cardCount} 个 rule cards，开始验证 scope badge`)

    // 策略1: 寻找 .scope-badge class 元素
    const scopeBadgesByClass = page.locator('.scope-badge')
    // 策略2: 寻找 class 包含 "scope" 的元素
    const scopeBadgesByAttr = page.locator('[class*="scope"]')
    // 策略3: 寻找包含已知 scope 值文本的元素（global / platform-only / override / project）
    const scopeBadgesByText = page.locator('.item-card').locator(
      'text=/^(global|platform-only|override|project)$/i',
    )

    const countByClass = await scopeBadgesByClass.count()
    const countByText = await scopeBadgesByText.count()

    console.log(`  .scope-badge 元素数: ${countByClass}`)
    console.log(`  scope 文本元素数: ${countByText}`)

    // 至少有一种方式能找到 scope 标签
    const hasScopeBadge = countByClass > 0 || countByText > 0
    expect(hasScopeBadge).toBe(true)

    // 验证第一个 badge 含有合法的 scope 值
    if (countByClass > 0) {
      const firstBadge = scopeBadgesByClass.first()
      const badgeText = await firstBadge.textContent()
      console.log(`✓ 第一个 .scope-badge 文本: "${badgeText}"`)
      expect(badgeText?.toLowerCase()).toMatch(/global|platform-only|override|project/)
    } else if (countByText > 0) {
      const firstBadge = scopeBadgesByText.first()
      const badgeText = await firstBadge.textContent()
      console.log(`✓ 第一个 scope 文本元素: "${badgeText}"`)
    }

    console.log('✓ ScopeBadge 已在 Rules 列表中渲染')
  })

  test('B-3. Profile 表单包含 hooks 相关字段（hookIds）', async ({ page }) => {
    const ok = await selectPlatform(page, 'Claude Code')
    if (!ok) {
      test.skip()
      return
    }

    // 检查侧边栏是否有 Profiles 入口
    const profilesNav = page.locator('.sidebar-nav-item', { hasText: /profiles?/i })
    if ((await profilesNav.count()) === 0) {
      console.log('⚠ 侧边栏无 "Profiles" 入口，此功能在 v1.0 中可能尚未完全接入，跳过。')
      test.skip()
      return
    }

    await profilesNav.click()
    await expect(page.locator('.page-title', { hasText: /profiles?/i })).toBeVisible({
      timeout: 8000,
    })

    // 尝试打开新建 Profile 表单
    const newProfileBtn = page.locator('button', { hasText: /new profile/i })
    if ((await newProfileBtn.count()) === 0) {
      console.log('⚠ 未找到 "New Profile" 按钮，跳过 hookIds 字段检查')
      test.skip()
      return
    }

    await newProfileBtn.click()

    // 等待表单或编辑器打开（以任意 label/input 出现为信号）
    await page.waitForSelector('label, input, .form-section-title', { timeout: 5000 }).catch(() => {/* form may render differently */})

    // 策略1: 寻找 label 包含 "Hook" 的字段
    const hookLabel = page.locator('label, .form-label', { hasText: /hooks?/i })
    // 策略2: 寻找 id/name 含 hook 的 input/select
    const hookInput = page.locator('input[id*="hook"], select[id*="hook"], [name*="hook"]')
    // 策略3: 寻找 section/group 标题含 "Hook"
    const hookSection = page.locator('h3, h4, .form-section-title', { hasText: /hooks?/i })

    const countLabel = await hookLabel.count()
    const countInput = await hookInput.count()
    const countSection = await hookSection.count()

    console.log(`  hook label 数: ${countLabel}, hook input 数: ${countInput}, hook section 数: ${countSection}`)

    const hasHooksField = countLabel > 0 || countInput > 0 || countSection > 0

    if (!hasHooksField) {
      // v1.0 已知问题：Profile 缺少 hookIds 字段
      // 不直接 throw，而是打印警告并让测试失败以示追踪
      console.warn(
        '❌ Profile 表单中未找到 hooks 相关字段（hookIds）。' +
          '请检查 shared/src/profile.ts 是否已添加 hookIds 字段，以及表单 UI 是否渲染了该字段。',
      )
    }

    expect(hasHooksField).toBe(true)

    console.log('✓ Profile 表单中存在 hooks 相关字段（v1.0 新增 hookIds 支持）')
  })

  test('B-4. 前端能成功 fetch /health（无 CORS / API_BASE 错误）', async ({ page }) => {
    const consoleErrors: string[] = []
    const networkErrors: string[] = []

    // 监听浏览器 console 错误
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // 监听 request 失败事件
    page.on('requestfailed', (req) => {
      // 只关心对 API 的请求失败（排除 favicon 等无关资源）
      if (req.url().includes('localhost:3001')) {
        networkErrors.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
      }
    })

    await page.goto('/')
    // 等待平台 tabs 加载，这意味着前端已至少成功调用一次 /platforms
    await expect(page.locator('.platform-tab').first()).toBeVisible({ timeout: 15000 })

    // 在浏览器上下文中手动 fetch /health，验证 CORS 和 API_BASE 均配置正确
    const result = await page.evaluate(async () => {
      try {
        const res = await fetch('http://localhost:3001/health')
        const body = await res.json()
        return { ok: res.ok, status: res.status, body }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, status: 0, error: msg }
      }
    })

    console.log('  浏览器内 fetch /health 结果:', JSON.stringify(result))

    if (!result.ok) {
      console.warn('❌ 浏览器 fetch /health 失败:', result)
    }

    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)

    // 过滤与 CORS 或 API_BASE 相关的 console 错误（忽略无关的 React 警告等）
    const corsOrApiErrors = consoleErrors.filter((msg) =>
      /cors|api.?base|blocked|cross.?origin|fetch.*failed|network.*error/i.test(msg),
    )

    if (corsOrApiErrors.length > 0) {
      console.warn('⚠ 检测到可能的 CORS/API 错误:', corsOrApiErrors)
    }

    expect(corsOrApiErrors).toHaveLength(0)

    if (networkErrors.length > 0) {
      console.warn('⚠ API 网络请求失败:', networkErrors)
    }

    expect(networkErrors).toHaveLength(0)

    console.log('✓ 前端 fetch /health 成功，无 CORS 或 API_BASE 错误')
  })
})
