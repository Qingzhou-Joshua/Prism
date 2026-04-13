import type { Revision } from '@prism/shared'
import { request } from './client.js'

export const revisionsApi = {
  list(): Promise<Revision[]> {
    return request<{ items: Revision[] }>('/revisions').then((r) => r?.items ?? [])
  },
  async get(id: string): Promise<Revision | null> {
    const r = await request<{ revision: Revision }>(`/revisions/${id}`)
    return r?.revision ?? null
  },
  rollback(id: string): Promise<void> {
    return request<unknown>(`/revisions/${id}/rollback`, { method: 'POST' }).then(() => undefined)
  },
}
