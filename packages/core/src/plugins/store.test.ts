import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PluginStore } from './store.js'

let dir: string
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prism-plugins-')) })
afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

describe('PluginStore', () => {
  it('lists Claude-style plugins and toggles enabledPlugins', async () => {
    await mkdir(join(dir, 'plugins'))
    const installedPath = join(dir, 'plugins', 'installed_plugins.json')
    const settingsPath = join(dir, 'settings.json')
    await writeFile(installedPath, JSON.stringify({
      version: 2,
      plugins: { 'figma@official': [{ scope: 'user', version: '1.0.0', installPath: '/x' }] },
    }))
    await writeFile(settingsPath, JSON.stringify({ model: 'opus', enabledPlugins: { 'figma@official': true } }))
    const store = new PluginStore({ type: 'claude', installedPath, settingsPath }, 'claude-code')

    const [p] = await store.list()
    expect(p).toMatchObject({ id: 'figma@official', name: 'figma', source: 'official', version: '1.0.0', enabled: true })

    await store.setEnabled('figma@official', false)
    const settings = JSON.parse(await readFile(settingsPath, 'utf-8'))
    expect(settings).toEqual({ model: 'opus', enabledPlugins: { 'figma@official': false } })
  })

  it('toggles Codex plugins in config.toml, keeping other content', async () => {
    const configPath = join(dir, 'config.toml')
    await writeFile(configPath, '# c\n[plugins."pdf@rt"]\nenabled = true\n\n[features]\nx = 1\n')
    const store = new PluginStore({ type: 'codex', configPath, cacheDir: join(dir, 'cache') }, 'codex')

    await store.setEnabled('pdf@rt', false)
    const text = await readFile(configPath, 'utf-8')
    expect(text).toContain('# c')
    expect(text).toContain('enabled = false')
    expect(text).toContain('[features]')
    expect((await store.list())[0].enabled).toBe(false)
  })

  it('refuses to toggle OpenCode plugins', async () => {
    const configPath = join(dir, 'opencode.json')
    await writeFile(configPath, JSON.stringify({ plugin: ['oh-my-x'] }))
    const store = new PluginStore({ type: 'opencode', configPath }, 'opencode')
    expect((await store.list())[0].toggleable).toBe(false)
    await expect(store.setEnabled('oh-my-x', false)).rejects.toThrow(/cannot be toggled/)
  })
})
