import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { claudeCodeAdapter } from './index.js'

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}))

import { access } from 'node:fs/promises'

describe('claudeCodeAdapter', () => {
  const originalHome = process.env.HOME

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.HOME = '/home/testuser'
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

  it('returns detected: false when neither ~/.claude-internal nor ~/.claude exist', async () => {
    vi.mocked(access)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))

    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(false)
    expect(result.message).toContain('not found')
  })

  it('returns detected: true using ~/.claude-internal when it exists', async () => {
    // First call (.claude-internal): success; second call (rules/): fail
    vi.mocked(access)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'))

    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.configPath).toBe('/home/testuser/.claude-internal')
    expect(result.rulesDetected).toBe(false)
  })

  it('returns detected: true using ~/.claude as fallback when only it exists', async () => {
    // First call (.claude-internal): fail; second call (.claude): success; third call (rules/): fail
    vi.mocked(access)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'))

    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.configPath).toBe('/home/testuser/.claude')
    expect(result.rulesDetected).toBe(false)
  })

  it('returns rulesDetected: true when rules/ subdirectory exists', async () => {
    // First call (.claude-internal): success; second call (rules/): success
    vi.mocked(access)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    const result = await claudeCodeAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.rulesDetected).toBe(true)
    expect(result.message).toContain('rules')
  })

  it('has correct adapter id, displayName, and capabilities', () => {
    expect(claudeCodeAdapter.id).toBe('claude-code')
    expect(claudeCodeAdapter.displayName).toBe('Claude Code')
    expect(claudeCodeAdapter.capabilities).toEqual({ rules: true, profiles: true, skills: true, agents: true, mcp: true, hooks: true })
  })
})
