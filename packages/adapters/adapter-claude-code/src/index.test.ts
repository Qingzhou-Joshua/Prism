import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { claudeCodeAdapter } from './index.js'

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readdir: vi.fn(),
}))

import { access, readdir } from 'node:fs/promises'

describe('claudeCodeAdapter', () => {
  const originalHome = process.env.HOME

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.HOME = '/home/testuser'
    // By default, readdir returns no .claude* dirs so access fallback is tried
    vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'))
  })

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
  })

  it('returns detected: false when HOME is not set', async () => {
    delete process.env.HOME
    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(false)
    expect(result.message).toContain('HOME')
  })

  it('returns detected: false when no ~/.claude directory exists', async () => {
    // readdir throws, access also throws
    vi.mocked(access).mockRejectedValueOnce(new Error('ENOENT'))

    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(false)
    expect(result.message).toContain('not found')
  })

  it('returns detected: true using ~/.claude when it exists via readdir', async () => {
    // readdir returns .claude dir; rules/ access fails
    vi.mocked(readdir).mockResolvedValueOnce([
      { name: '.claude', isDirectory: () => true, isFile: () => false } as never,
    ])
    vi.mocked(access).mockRejectedValueOnce(new Error('ENOENT'))

    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.configPath).toBe('/home/testuser/.claude')
    expect(result.rulesDetected).toBe(false)
  })

  it('returns detected: true using ~/.claude via access fallback', async () => {
    // readdir throws, access on ~/.claude succeeds; rules/ access fails
    vi.mocked(access)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'))

    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.configPath).toBe('/home/testuser/.claude')
    expect(result.rulesDetected).toBe(false)
  })

  it('returns rulesDetected: true when rules/ subdirectory exists', async () => {
    // readdir returns .claude dir; rules/ access succeeds
    vi.mocked(readdir).mockResolvedValueOnce([
      { name: '.claude', isDirectory: () => true, isFile: () => false } as never,
    ])
    vi.mocked(access).mockResolvedValueOnce(undefined)

    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.rulesDetected).toBe(true)
    expect(result.message).toContain('rules')
  })

  it('has correct adapter id, displayName, and capabilities', () => {
    expect(claudeCodeAdapter.id).toBe('claude-code')
    expect(claudeCodeAdapter.displayName).toBe('Claude Code')
    expect(claudeCodeAdapter.capabilities).toEqual({ rules: true, profiles: true, skills: true, agents: true, mcp: true, hooks: true, commands: true })
  })
})
