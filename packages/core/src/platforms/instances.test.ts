import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverPlatformInstances } from './instances.js'

const ENV_KEYS = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'XDG_CONFIG_HOME'] as const
let home: string
let savedEnv: Record<string, string | undefined>
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'prism-home-'))
  savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]))
  for (const k of ENV_KEYS) delete process.env[k]
})
afterEach(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  await rm(home, { recursive: true, force: true })
})

describe('discoverPlatformInstances', () => {
  it('matches every ~/.*claude* config dir as a Claude Code instance', async () => {
    await mkdir(join(home, '.claude', 'skills'), { recursive: true })
    await mkdir(join(home, '.tclaude'))
    await writeFile(join(home, '.tclaude', 'settings.json'), '{}')
    await mkdir(join(home, '.claude-empty')) // no markers → ignored
    await writeFile(join(home, '.claude.json'), '{}') // file, not dir → ignored

    const found = await discoverPlatformInstances(home)
    const claude = found.filter(p => p.kind === 'claude-code')
    expect(claude.map(p => p.id)).toEqual(['claude-code', 'claude-code-tclaude'])
    expect(claude[0].mcp?.path).toBe(join(home, '.claude.json'))
    expect(claude[1].mcp?.path).toBe(join(home, '.tclaude', '.claude.json'))
    expect(claude[1].displayName).toBe('Claude Code (.tclaude)')
  })

  it('detects other tools only when their dirs exist', async () => {
    await mkdir(join(home, '.cursor'))
    await mkdir(join(home, '.config', 'opencode', 'agent'), { recursive: true })
    await writeFile(join(home, '.config', 'opencode', 'opencode.jsonc'), '{}')

    const found = await discoverPlatformInstances(home)
    expect(found.map(p => p.id).sort()).toEqual(['cursor', 'opencode'])
    const oc = found.find(p => p.id === 'opencode')!
    expect(oc.agentsDir).toBe(join(home, '.config', 'opencode', 'agent'))
    expect(oc.mcp).toMatchObject({ format: 'jsonc', dialect: 'opencode' })
  })
})

describe('CLAUDE_CONFIG_DIR', () => {
  it('adds the env-configured dir even outside the ~/.*claude* pattern', async () => {
    const custom = join(home, 'cfg')
    await mkdir(custom)
    process.env.CLAUDE_CONFIG_DIR = custom
    const found = await discoverPlatformInstances(home)
    expect(found.find(p => p.baseDir === custom)?.kind).toBe('claude-code')
  })
})
