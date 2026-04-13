import type { Profile, CreateProfileDto, UpdateProfileDto, PublishPreview, Revision } from '@prism/shared'
import { request } from './client.js'

export const profilesApi = {
  list(): Promise<Profile[]> {
    return request<{ items: Profile[] }>('/profiles').then((r) => r?.items ?? [])
  },
  async get(id: string): Promise<Profile | null> {
    try { return await request<Profile>(`/profiles/${id}`) }
    catch (e) { if (e instanceof Error && e.message.startsWith('HTTP 404')) return null; throw e }
  },
  create(dto: CreateProfileDto): Promise<Profile> {
    return request<Profile>('/profiles', { method: 'POST', body: JSON.stringify(dto) }).then((r) => r!)
  },
  update(id: string, dto: UpdateProfileDto): Promise<Profile> {
    return request<Profile>(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(dto) }).then((r) => r!)
  },
  delete(id: string): Promise<void> {
    return request<null>(`/profiles/${id}`, { method: 'DELETE' }).then(() => undefined)
  },
  preview(id: string): Promise<PublishPreview> {
    return request<PublishPreview>(`/profiles/${id}/preview`).then((r) => r!)
  },
  async publish(id: string): Promise<{ revision: Revision }> {
    const r = await request<{ revision: Revision }>(`/profiles/${id}/publish`, { method: 'POST' })
    if (!r) throw new Error('No response from publish endpoint')
    return r
  },
}
