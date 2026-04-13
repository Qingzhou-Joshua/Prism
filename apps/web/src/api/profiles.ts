import type { Profile, CreateProfileDto, UpdateProfileDto, PublishPreview } from '@prism/shared'

const API_BASE = 'http://localhost:3001'

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

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
}
