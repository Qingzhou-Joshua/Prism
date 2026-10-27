import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { API_BASE } from './helpers/api.js'

// These tests write to the platform config files the API server sees.
// Run the server against a sandbox HOME (see README / CLAUDE.md), never your real one:
//   HOME=/tmp/prism-e2e-home pnpm --filter @prism/server dev
const SANDBOX_HOME = process.env.PRISM_E2E_HOME ?? '/tmp/prism-e2e-home'

interface PlatformItem {
  id: string
  kind?: string
  displayName: string
  detected: boolean
  configPath?: string
  mcpConfigPath?: string
  capabilities: Record<string, boolean | undefined>
}

async function platforms(page: Page): Promise<PlatformItem[]> {
  const res = await page.request.get(`${API_BASE}/platforms`)
  return ((await res.json()) as { items: PlatformItem[] }).items
}

async function openPlatform(page: Page, displayName: string) {
  await page.goto('/')
  const tab = page.locator('.platform-tab', { hasText: displayName })
  await expect(tab).toBeVisible({ timeout: 10000 })
  await tab.click()
}

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${API_BASE}/platforms`)
  const { items } = (await res.json()) as { items: PlatformItem[] }
  const sandboxed = items.every(p => !p.configPath || p.configPath.startsWith(SANDBOX_HOME))
  test.skip(!sandboxed, `API server is not running against the sandbox HOME (${SANDBOX_HOME}); refusing to write real configs`)
})

test.describe('Platform discovery', () => {
  test('every discovered platform has a tab, OpenClaw is gone', async ({ page }) => {
    const items = await platforms(page)
    await page.goto('/')
    for (const p of items) {
      await expect(page.locator('.platform-tab', { hasText: p.displayName })).toBeVisible({ timeout: 10000 })
    }
    await expect(page.locator('.platform-tab', { hasText: /openclaw/i })).toHaveCount(0)
  })

  test('sidebar only shows capabilities the platform supports (Codex has no Rules)', async ({ page }) => {
    const codex = (await platforms(page)).find(p => p.id === 'codex')
    test.skip(!codex, 'Codex not discovered')
    await openPlatform(page, codex!.displayName)

    const nav = page.locator('.app-sidebar .sidebar-nav-item')
    await expect(nav.filter({ hasText: /^(MCP|MCP 服务器|MCP Servers)/ })).toHaveCount(1)
    await expect(nav.filter({ hasText: /^(Rules|规则)$/ })).toHaveCount(0)
    await expect(nav.filter({ hasText: /^(Plugins|插件)$/ })).toHaveCount(1)
    // Landing page must be a supported capability, not an empty Rules page
    await expect(page.locator('.page-title').first()).not.toHaveText(/^(Rules|规则)$/)
  })
})

test.describe('MCP — native config per platform', () => {
  test('create and delete a server in Codex config.toml, preserving other content', async ({ page }) => {
    const codex = (await platforms(page)).find(p => p.id === 'codex')
    test.skip(!codex?.mcpConfigPath, 'Codex not discovered')
    const tomlPath = codex!.mcpConfigPath!
    const before = await readFile(tomlPath, 'utf-8')

    await openPlatform(page, codex!.displayName)
    await page.locator('.sidebar-nav-item', { hasText: /^(MCP|MCP 服务器|MCP Servers)/ }).click()
    await expect(page.locator('.item-card-name', { hasText: 'node_repl' })).toBeVisible({ timeout: 10000 })

    // Create
    await page.locator('button', { hasText: /新建服务器|New Server/ }).first().click()
    await page.getByPlaceholder('e.g. context7').fill('e2e-sandbox-mcp')
    await page.getByPlaceholder('e.g. npx').fill('npx')
    await page.locator('textarea').fill('-y\n@e2e/server with space')
    await page.locator('button.btn-primary', { hasText: /保存|Save/ }).click()

    await expect(page.locator('.item-card-name', { hasText: 'e2e-sandbox-mcp' })).toBeVisible({ timeout: 10000 })
    const afterCreate = await readFile(tomlPath, 'utf-8')
    expect(afterCreate).toContain('[mcp_servers.e2e-sandbox-mcp]')
    expect(afterCreate).toContain('"@e2e/server with space"')
    // Everything that was there before is still there (comments, plugins, other servers)
    expect(afterCreate.startsWith(before.trimEnd().split('\n')[0])).toBe(true)
    expect(afterCreate).toContain('[mcp_servers.node_repl]')
    expect(afterCreate).toContain('[plugins.')

    // Delete
    page.once('dialog', d => void d.accept())
    const card = page.locator('.item-card', { hasText: 'e2e-sandbox-mcp' })
    await card.locator('button.btn-danger').click()
    await expect(page.locator('.item-card-name', { hasText: 'e2e-sandbox-mcp' })).toHaveCount(0)
    expect(await readFile(tomlPath, 'utf-8')).not.toContain('e2e-sandbox-mcp')
  })

  test('Claude Code MCP list reads ~/.claude.json, not settings.json', async ({ page }) => {
    const claude = (await platforms(page)).find(p => p.id === 'claude-code')
    test.skip(!claude, 'Claude Code (~/.claude) not discovered')
    expect(claude!.mcpConfigPath).toBe(join(SANDBOX_HOME, '.claude.json'))
    const servers = Object.keys(JSON.parse(await readFile(claude!.mcpConfigPath!, 'utf-8')).mcpServers ?? {})
    test.skip(servers.length === 0, 'no MCP servers in sandbox ~/.claude.json')

    await openPlatform(page, claude!.displayName)
    await page.locator('.sidebar-nav-item', { hasText: /^(MCP|MCP 服务器|MCP Servers)/ }).click()
    await expect(page.locator('.item-card-name', { hasText: servers[0] })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Plugins', () => {
  test('toggle a Claude plugin off and on via enabledPlugins', async ({ page }) => {
    const items = await platforms(page)
    const target = items.find(p => p.id === 'claude-code-tclaude') ?? items.find(p => p.kind === 'claude-code')
    test.skip(!target, 'no Claude instance')
    const settingsPath = join(target!.configPath!, 'settings.json')
    const enabledPlugins = JSON.parse(await readFile(settingsPath, 'utf-8')).enabledPlugins ?? {}
    const pluginId = Object.keys(enabledPlugins).find(k => enabledPlugins[k] === true)
    test.skip(!pluginId, 'no enabled plugin to toggle')
    const pluginName = pluginId!.split('@')[0]

    await openPlatform(page, target!.displayName)
    await page.locator('.sidebar-nav-item', { hasText: /^(Plugins|插件)$/ }).click()
    const card = page.locator('.item-card', { hasText: pluginName })
    await expect(card).toBeVisible({ timeout: 10000 })
    const toggle = card.getByRole('switch')
    await expect(toggle).toBeChecked()

    // Disabling asks for confirmation, listing what the plugin contributes
    page.once('dialog', d => { expect(d.message()).toMatch(/Skills|技能/); void d.accept() })
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    expect(JSON.parse(await readFile(settingsPath, 'utf-8')).enabledPlugins[pluginId!]).toBe(false)

    await toggle.click()
    await expect(toggle).toBeChecked()
    const settings = JSON.parse(await readFile(settingsPath, 'utf-8'))
    expect(settings.enabledPlugins[pluginId!]).toBe(true)
    // Other settings keys are untouched
    expect(Object.keys(settings)).toContain('model')
  })

  test('OpenCode plugins are listed read-only', async ({ page }) => {
    const oc = (await platforms(page)).find(p => p.id === 'opencode')
    test.skip(!oc, 'OpenCode not discovered')
    await openPlatform(page, oc!.displayName)
    await page.locator('.sidebar-nav-item', { hasText: /^(Plugins|插件)$/ }).click()
    const toggle = page.locator('.item-card').first().getByRole('switch')
    await expect(toggle).toBeVisible({ timeout: 10000 })
    await expect(toggle).toBeDisabled()
  })
})

test.describe('Plugin-provided assets (own + plugin groups)', () => {
  // Requires the sandbox fixture plugin demo@test-market installed into .tclaude
  // (see /tmp/prism-e2e-home/.tclaude/plugins/cache/test-market/demo).
  async function openTclaude(page: Page, nav: RegExp) {
    const target = (await platforms(page)).find(p => p.id === 'claude-code-tclaude')
    test.skip(!target, 'no .tclaude instance in sandbox')
    await openPlatform(page, target!.displayName)
    await page.locator('.sidebar-nav-item', { hasText: nav }).click()
  }

  test('skills page lists own skills first and the plugin as a collapsed read-only group', async ({ page }) => {
    await openTclaude(page, /^(Skills|技能)/)
    // Plugin groups load asynchronously — wait for the fixture plugin's chip
    await expect(page.locator('.source-chip', { hasText: 'demo' })).toBeVisible({ timeout: 10000 })
    const group = page.locator('.source-section--plugin', { hasText: 'demo' })

    // Sidebar shows own + plugin counts
    await expect(page.locator('.sidebar-nav-item', { hasText: /^(Skills|技能)/ }).locator('.sidebar-nav-count')).toContainText('+1')
    // Collapsed by default
    await expect(group.locator('.item-card')).toHaveCount(0)

    // Expand → read-only card with decoded summary → viewer
    await group.locator('.source-section-header').click()
    const card = group.locator('.item-card--readonly', { hasText: 'demo-skill' })
    await expect(card).toContainText('Demo skill: shipped by the e2e fixture plugin')
    await card.click()
    const viewer = page.getByRole('dialog', { name: 'demo-skill' })
    await expect(viewer).toContainText('# Demo body')
    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
  })

  test('search spans plugin assets and auto-expands matching groups', async ({ page }) => {
    await openTclaude(page, /^(Skills|技能)/)
    await page.locator('input[type=search]').fill('fixture plugin')
    await expect(page.locator('.item-card--readonly', { hasText: 'demo-skill' })).toBeVisible()
  })

  test('plugin detail shows composition tabs', async ({ page }) => {
    await openTclaude(page, /^(Plugins|插件)/)
    const card = page.locator('.item-card', { hasText: 'demo' }).first()
    await expect(card).toContainText(/1 Skills|1 技能/)
    await card.click()
    await expect(page.getByRole('tab', { name: /Skills|技能/ })).toBeVisible()
    await page.getByRole('tab', { name: /Agents|智能体/ }).click()
    await expect(page.locator('.item-card--readonly', { hasText: 'demo-agent' })).toBeVisible()
  })

  test('knowledge is hidden from the global nav', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.global-nav-btn').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.global-nav-btn', { hasText: /Knowledge|知识库/ })).toHaveCount(0)
  })
})
