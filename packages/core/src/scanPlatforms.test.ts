import { describe, it, expect, vi } from 'vitest'
import { scanPlatforms } from './index.js'
import type { PlatformAdapter } from './index.js'
import type { PlatformScanResult } from '@prism/shared'

describe('scanPlatforms', () => {
  it('returns empty array when no adapters provided', async () => {
    const result = await scanPlatforms([])
    expect(result).toEqual([])
  })

  it('calls scan() on each adapter and returns results', async () => {
    const mockResult1: PlatformScanResult = {
      id: 'openclaw',
      displayName: 'OpenClaw',
      detected: true,
      configPath: '/home/user/.openclaw',
      capabilities: { rules: true, profiles: false },
    }
    const mockResult2: PlatformScanResult = {
      id: 'codebuddy',
      displayName: 'CodeBuddy',
      detected: false,
      capabilities: { rules: false, profiles: false },
    }

    const adapter1: PlatformAdapter = {
      id: 'openclaw',
      displayName: 'OpenClaw',
      scan: vi.fn().mockResolvedValue(mockResult1),
    }
    const adapter2: PlatformAdapter = {
      id: 'codebuddy',
      displayName: 'CodeBuddy',
      scan: vi.fn().mockResolvedValue(mockResult2),
    }

    const result = await scanPlatforms([adapter1, adapter2])

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(mockResult1)
    expect(result[1]).toEqual(mockResult2)
    expect(adapter1.scan).toHaveBeenCalledOnce()
    expect(adapter2.scan).toHaveBeenCalledOnce()
  })

  it('runs adapter scans in parallel', async () => {
    const callOrder: number[] = []

    const slowAdapter: PlatformAdapter = {
      id: 'openclaw',
      displayName: 'OpenClaw',
      scan: vi.fn().mockImplementation(async () => {
        callOrder.push(1)
        await new Promise((resolve) => setTimeout(resolve, 50))
        return {
          id: 'openclaw',
          displayName: 'OpenClaw',
          detected: false,
          capabilities: { rules: true, profiles: false },
        } satisfies PlatformScanResult
      }),
    }

    const fastAdapter: PlatformAdapter = {
      id: 'codebuddy',
      displayName: 'CodeBuddy',
      scan: vi.fn().mockImplementation(async () => {
        callOrder.push(2)
        return {
          id: 'codebuddy',
          displayName: 'CodeBuddy',
          detected: false,
          capabilities: { rules: false, profiles: false },
        } satisfies PlatformScanResult
      }),
    }

    const startTime = Date.now()
    await scanPlatforms([slowAdapter, fastAdapter])
    const elapsed = Date.now() - startTime

    // 并行执行时 elapsed 应该约 50ms，而非 100ms+
    expect(elapsed).toBeLessThan(90)
    // 两个 adapter 都被调用了
    expect(callOrder).toContain(1)
    expect(callOrder).toContain(2)
  })
})
