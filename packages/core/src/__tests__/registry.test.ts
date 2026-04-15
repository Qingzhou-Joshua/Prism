import { describe, it, expect, vi } from 'vitest'
import { createAdapterRegistry } from '../registry.js'
import type { PlatformAdapter } from '../index.js'
import type { PlatformId } from '@prism/shared'

function makeAdapter(id: string): PlatformAdapter {
  return {
    id: id as PlatformId,
    displayName: id,
    capabilities: { rules: false, profiles: false },
    scan: vi.fn().mockResolvedValue({
      id,
      displayName: id,
      detected: false,
      message: '',
      capabilities: { rules: false, profiles: false },
    }),
  }
}

describe('createAdapterRegistry', () => {
  it('registers adapters and returns them via getAll()', () => {
    const a = makeAdapter('claude-code')
    const b = makeAdapter('codebuddy')
    const registry = createAdapterRegistry([a, b])
    expect(registry.getAll()).toHaveLength(2)
  })

  it('returns adapter by id via get()', () => {
    const a = makeAdapter('claude-code')
    const registry = createAdapterRegistry([a])
    expect(registry.get('claude-code' as PlatformId)).toBe(a)
  })

  it('returns undefined for unknown id', () => {
    const registry = createAdapterRegistry([])
    expect(registry.get('codebuddy' as PlatformId)).toBeUndefined()
  })

  it('scanAll() calls scan on all adapters and returns results', async () => {
    const a = makeAdapter('claude-code')
    const b = makeAdapter('codebuddy')
    const registry = createAdapterRegistry([a, b])
    const results = await registry.scanAll()
    expect(results).toHaveLength(2)
    expect(a.scan).toHaveBeenCalledOnce()
    expect(b.scan).toHaveBeenCalledOnce()
  })
})
