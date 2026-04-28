import { test, expect } from '@playwright/test'
import { API_BASE } from './helpers/api.js'
import { selectPlatform } from './helpers/navigate.js'

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Group A: 基础连通性', () => {
  test('A-1. GET /health 返回 { status: "ok" }', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`)
    expect(res.status()).toBe(200)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toHaveProperty('status', 'ok')

    console.log(`✓ /health 响应 200，body: ${JSON.stringify(body)}`)
  })

  test('A-2. GET /platforms 返回包含 claude-code、codebuddy、openclaw 的数组', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/platforms`)
    expect(res.status()).toBe(200)

    const body = (await res.json()) as unknown

    // 兼容多种响应结构：数组 / { platforms: [...] } / { items: [...] }
    const platforms: Array<Record<string, unknown>> = Array.isArray(body)
      ? (body as Array<Record<string, unknown>>)
      : ((body as Record<string, unknown>).platforms as Array<Record<string, unknown>> | undefined)
          ?? ((body as Record<string, unknown>).items as Array<Record<string, unknown>> | undefined)
          ?? []

    expect(platforms.length).toBeGreaterThanOrEqual(1)

    const ids = platforms.map((p) => (p.id ?? p.platformId ?? '') as string)
    console.log(`✓ /platforms 返回 ${platforms.length} 个平台: ${ids.join(', ')}`)

    // 连通性测试只验证核心平台，openclaw 的注册状态由 v1-features.spec.ts B-1 负责
    expect(ids).toContain('claude-code')
    expect(ids).toContain('codebuddy')

    console.log('✓ claude-code / codebuddy 均已注册')
  })

  test('A-3. 浏览器能打开 http://localhost:5173，标题包含 "Prism"', async ({ page }) => {
    await page.goto('/')

    // 等待页面主体有内容（不是空白 loading）
    await expect(page.locator('body')).not.toBeEmpty({ timeout: 10000 })

    const title = await page.title()
    expect(title.toLowerCase()).toContain('prism')

    console.log(`✓ 前端页面加载成功，标题: "${title}"`)
  })

  test('A-4. 平台 tab 出现（至少包含 Claude Code）', async ({ page }) => {
    await page.goto('/')

    // 给后端扫描足够时间，tab 才能渲染
    await expect(page.locator('.platform-tab').first()).toBeVisible({ timeout: 15000 })

    const tabs = page.locator('.platform-tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(1)

    // Claude Code tab 必须存在
    const claudeTab = page.locator('.platform-tab', { hasText: 'Claude Code' })
    await expect(claudeTab).toBeVisible()

    console.log(`✓ 平台 tabs 已渲染（共 ${tabCount} 个），Claude Code tab 可见`)
  })

  test('A-5. 选中 Claude Code 后侧边栏显示所有核心导航项', async ({ page }) => {
    await selectPlatform(page, 'Claude Code')

    // 这 6 项是 Claude Code 平台的核心功能导航
    const expectedSections = ['Rules', 'Skills', 'Agents', 'MCP Servers', 'Hooks', 'Conflicts']

    for (const section of expectedSections) {
      const navItem = page.locator('.sidebar-nav-item', { hasText: section })
      await expect(navItem).toBeVisible({ timeout: 5000 })
      console.log(`  ✓ 侧边栏项 "${section}" 可见`)
    }

    console.log('✓ 所有核心侧边栏导航项均已显示')
  })
})
