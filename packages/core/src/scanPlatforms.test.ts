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
      id: 'claude-code',
      displayName: 'Claude Code',
      detected: true,
      configPath: '/home/user/.claude-internal',
      capabilities: { rules: true, profiles: false },
    }
    const mockResult2: PlatformScanResult = {
      id: 'codebuddy',
      displayName: 'CodeBuddy',
      detected: false,
      capabilities: { rules: false, profiles: false },
    }

    const adapter1: PlatformAdapter = {
      id: 'claude-code',
      displayName: 'Claude Code',
      capabilities: { rules: true, profiles: false },
      scan: vi.fn().mockResolvedValue(mockResult1),
    }
    const adapter2: PlatformAdapter = {
      id: 'codebuddy',
      displayName: 'CodeBuddy',
      capabilities: { rules: false, profiles: false },
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
    // 追踪 resolve 完成顺序（而非 start 顺序）
    const resolveOrder: string[] = []

    const slowAdapter: PlatformAdapter = {
      id: 'claude-code',
      displayName: 'Claude Code',
      capabilities: { rules: true, profiles: false },
      scan: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        resolveOrder.push('slow')
        return {
          id: 'claude-code',
          displayName: 'Claude Code',
          detected: false,
          capabilities: { rules: true, profiles: false },
        } satisfies PlatformScanResult
      }),
    }

    const fastAdapter: PlatformAdapter = {
      id: 'codebuddy',
      displayName: 'CodeBuddy',
      capabilities: { rules: false, profiles: false },
      scan: vi.fn().mockImplementation(async () => {
        resolveOrder.push('fast')
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

    // 并行时 fastAdapter 先 resolve，slowAdapter 后 resolve
    expect(resolveOrder).toEqual(['fast', 'slow'])
    // 并行执行总耗时应远小于顺序执行（50ms + 0ms = 50ms，而非 50ms + 0ms 顺序）
    // 使用宽松阈值（150ms）保证 CI 稳定性
    expect(elapsed).toBeLessThan(150)
  })
})
