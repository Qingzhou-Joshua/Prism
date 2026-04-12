import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { openclawAdapter } from './index.js'

// Mock node:fs/promises (the module used by the adapter)
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}))

import { access } from 'node:fs/promises'

describe('openclawAdapter', () => {
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
    const result = await openclawAdapter.scan()
    expect(result.detected).toBe(false)
    expect(result.message).toContain('HOME')
  })

  it('returns detected: false when ~/.openclaw does not exist', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))

    const result = await openclawAdapter.scan()
    expect(result.detected).toBe(false)
  })

  it('returns detected: true when ~/.openclaw exists but rules/ does not', async () => {
    // First call (main dir): success; second call (rules/): fail
    vi.mocked(access)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'))

    const result = await openclawAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.configPath).toBe('/home/testuser/.openclaw')
    expect(result.rulesDetected).toBe(false)
  })

  it('returns rulesDetected: true when ~/.openclaw/rules exists', async () => {
    // Both calls succeed: main dir and rules/
    vi.mocked(access)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    const result = await openclawAdapter.scan()
    expect(result.detected).toBe(true)
    expect(result.rulesDetected).toBe(true)
    expect(result.message).toContain('rules')
  })

  it('has correct adapter id and displayName', () => {
    expect(openclawAdapter.id).toBe('openclaw')
    expect(openclawAdapter.displayName).toBe('OpenClaw')
  })
})
