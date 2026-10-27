import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { PluginInfo } from '@prism/shared'
import { pluginContents, readPluginAssetFile, scanPluginAssets } from './assets.js'

let root: string
let plugin: PluginInfo

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'prism-plugin-assets-'))
  const ip = join(root, 'demo', '1.0.0')
  await mkdir(join(ip, 'skills', 'pdf'), { recursive: true })
  await writeFile(join(ip, 'skills', 'pdf', 'SKILL.md'), '---\nname: pdf\ndescription: "Work with PDFs: read, merge"\n---\nbody')
  await mkdir(join(ip, 'agents'))
  await writeFile(join(ip, 'agents', 'reviewer.md'), '---\nname: reviewer\ndescription: Reviews code\n---\nx')
  await mkdir(join(ip, 'hooks'))
  await writeFile(join(ip, 'hooks', 'hooks.json'), JSON.stringify({
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }] },
  }))
  await writeFile(join(ip, '.mcp.json'), JSON.stringify({ mcpServers: { figma: { type: 'http', url: 'https://f/mcp' } } }))
  plugin = { id: 'demo@m', name: 'demo', installPath: ip, enabled: true, toggleable: true, platformId: 'claude-code' }
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

describe('plugin assets', () => {
  it('scans each asset type with decoded descriptions', async () => {
    const [skill] = await scanPluginAssets(plugin, 'skills')
    expect(skill).toMatchObject({ name: 'pdf', description: 'Work with PDFs: read, merge' })
    expect((await scanPluginAssets(plugin, 'hooks'))[0]).toMatchObject({ name: 'PreToolUse · Bash', detail: 'echo hi' })
    expect((await scanPluginAssets(plugin, 'mcp'))[0]).toMatchObject({ name: 'figma', detail: 'https://f/mcp' })
    expect(await pluginContents(plugin)).toEqual({ skills: 1, agents: 1, mcp: 1, hooks: 1 })
  })

  it('only reads files inside a plugin install dir', async () => {
    const [skill] = await scanPluginAssets(plugin, 'skills')
    expect(await readPluginAssetFile([plugin], skill.filePath!)).toContain('body')
    expect(await readPluginAssetFile([plugin], join(plugin.installPath!, '..', '..', '..', 'etc', 'passwd'))).toBeNull()
    expect(await readPluginAssetFile([plugin], '/etc/hosts')).toBeNull()
  })
})
