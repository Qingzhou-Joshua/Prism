import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { codebuddyAdapter } from './index.js'

// Mock node:fs/promises (the module used by the adapter)
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}))

import { access } from 'node:fs/promises'

describe('codebuddyAdapter', () => {
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
    const result = await codebuddyAdapter.scan()
    expect(result.detected).toBe(false)
    expect(result.message).toContain('HOME')
  })

  it('returns detected: false when ~/.codebuddy does not exist', async () => {
    vi.mocked(access).mockRejectedValueOnce(new Error('ENOENT'))

    const result = await codebuddyAdapter.scan()
    expect(result.detected).toBe(false)
  })

  it('returns detected: true with rulesDetected: false when only main dir exists', async () => {
    // First call (main dir): success; second call (rules/): fail
    vi.mocked(access)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'))

    const result = await codebuddyAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.configPath).toBe('/home/testuser/.codebuddy')
    expect(result.rulesDetected).toBe(false)
  })

  it('returns detected: true with rulesDetected: true when both dirs exist', async () => {
    // Both calls succeed: main dir and rules/
    vi.mocked(access)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    const result = await codebuddyAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.rulesDetected).toBe(true)
    expect(result.message).toContain('rules')
  })

  it('has correct adapter id, displayName, and capabilities', () => {
    expect(codebuddyAdapter.id).toBe('codebuddy')
    expect(codebuddyAdapter.displayName).toBe('CodeBuddy')
    expect(codebuddyAdapter.capabilities).toEqual({ rules: true, profiles: true, skills: true, agents: true })
  })
})
