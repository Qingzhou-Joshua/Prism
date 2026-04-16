import type { UnifiedHook, CreateHookDto, UpdateHookDto } from '@prism/shared'
import { request } from './client.js'

export const hooksApi = {
  list(platformId: string): Promise<UnifiedHook[]> {
    return request<{ items: UnifiedHook[] }>(`/hooks?platform=${encodeURIComponent(platformId)}`).then(r => r?.items ?? [])
  },

  async get(platformId: string, id: string): Promise<UnifiedHook | null> {
    try {
      return await request<UnifiedHook>(`/hooks/${id}?platform=${encodeURIComponent(platformId)}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },

  create(platformId: string, dto: CreateHookDto): Promise<UnifiedHook> {
    return request<UnifiedHook>(`/hooks?platform=${encodeURIComponent(platformId)}`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  update(platformId: string, id: string, dto: UpdateHookDto): Promise<UnifiedHook> {
    return request<UnifiedHook>(`/hooks/${id}?platform=${encodeURIComponent(platformId)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  delete(platformId: string, id: string): Promise<void> {
    return request<null>(`/hooks/${id}?platform=${encodeURIComponent(platformId)}`, { method: 'DELETE' }).then(() => undefined)
  },
}
