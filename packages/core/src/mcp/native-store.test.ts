import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { NativeMcpStore } from './native-store.js'

let dir: string
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prism-mcp-')) })
afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

describe('NativeMcpStore — standard JSON (mcpServers)', () => {
  it('reads stdio and remote servers and preserves unrelated keys on write', async () => {
    const path = join(dir, '.claude.json')
    await writeFile(path, JSON.stringify({
      numStartups: 3,
      mcpServers: {
        local: { command: 'npx', args: ['-y', 'x'], env: { A: '1' }, timeout: 5 },
        remote: { type: 'http', url: 'https://e.com/mcp' },
      },
    }))
    const store = new NativeMcpStore({ path, format: 'json', dialect: 'standard' }, 'claude-code')

    const all = await store.findAll()
    expect(all.map(s => [s.name, s.type])).toEqual([['local', 'stdio'], ['remote', 'http']])

    await store.update('local', { args: ['-y', 'y'] })
    const doc = JSON.parse(await readFile(path, 'utf-8'))
    expect(doc.numStartups).toBe(3)
    expect(doc.mcpServers.local).toEqual({ command: 'npx', args: ['-y', 'y'], env: { A: '1' }, timeout: 5 })
  })

  it('creates the file when missing, rejects duplicates, deletes', async () => {
    const path = join(dir, 'mcp.json')
    const store = new NativeMcpStore({ path, format: 'json', dialect: 'standard' }, 'cursor')
    await store.create({ name: 'a', command: 'node', args: ['s.js'], targetPlatforms: [] })
    await expect(store.create({ name: 'a', command: 'x', args: [], targetPlatforms: [] })).rejects.toThrow(/already exists/)
    expect(await store.delete('a')).toBe(true)
    expect(JSON.parse(await readFile(path, 'utf-8')).mcpServers).toEqual({})
  })

  it('finds servers whose name contains "/" by encoded or decoded id', async () => {
    const path = join(dir, 'mcp.json')
    await writeFile(path, JSON.stringify({ mcpServers: { 'a/b': { disabled: true } } }))
    const store = new NativeMcpStore({ path, format: 'json', dialect: 'standard' }, 'codebuddy')
    expect((await store.findById('a%2Fb'))?.enabled).toBe(false)
    expect((await store.findById('a/b'))?.name).toBe('a/b')
  })
})

describe('NativeMcpStore — OpenCode JSONC (mcp)', () => {
  it('maps command arrays and keeps comments', async () => {
    const path = join(dir, 'opencode.jsonc')
    await writeFile(path, '{\n  // my config\n  "model": "x",\n  "mcp": {\n    "fs": { "type": "local", "command": ["npx", "fs"], "enabled": true }\n  }\n}\n')
    const store = new NativeMcpStore({ path, format: 'jsonc', dialect: 'opencode' }, 'opencode')

    const [fs] = await store.findAll()
    expect(fs).toMatchObject({ name: 'fs', command: 'npx', args: ['fs'], enabled: true })

    await store.create({ name: 'web', command: '', args: [], type: 'http', url: 'https://w', targetPlatforms: [] })
    const text = await readFile(path, 'utf-8')
    expect(text).toContain('// my config')
    expect(text).toContain('"type": "remote"')
  })
})

describe('NativeMcpStore — Codex TOML (mcp_servers)', () => {
  const TOML = `# top comment
model = "gpt"

[mcp_servers.alpha]
command = "a"
args = ["1"]
startup_timeout_sec = 30

[mcp_servers.alpha.env]
K = "v"

[features]
x = true
`

  it('reads tables and updates one server without touching the rest', async () => {
    const path = join(dir, 'config.toml')
    await writeFile(path, TOML)
    const store = new NativeMcpStore({ path, format: 'toml', dialect: 'codex' }, 'codex')

    const [alpha] = await store.findAll()
    expect(alpha).toMatchObject({ name: 'alpha', command: 'a', args: ['1'], env: { K: 'v' } })

    await store.update('alpha', { args: ['2'] })
    await store.create({ name: 'beta', command: 'b', args: [], targetPlatforms: [] })
    const text = await readFile(path, 'utf-8')
    expect(text).toContain('# top comment')
    expect(text).toContain('[features]')
    expect(text).toContain('startup_timeout_sec = 30')
    expect(text).toContain('[mcp_servers.beta]')
    const names = (await store.findAll()).map(s => s.name).sort()
    expect(names).toEqual(['alpha', 'beta'])
    expect((await store.findById('alpha'))?.args).toEqual(['2'])

    await store.delete('alpha')
    expect(await readFile(path, 'utf-8')).not.toContain('alpha')
  })
})
