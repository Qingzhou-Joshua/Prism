import type { UnifiedCommand, CreateCommandDto, UpdateCommandDto } from '@prism/shared'
import { request } from './client.js'

export interface CommandProjectionItem {
  platformId: string
  fileName: string
  content: string
}

function platformQuery(platform?: string): string {
  return platform ? `?platform=${encodeURIComponent(platform)}` : ''
}

export const commandsApi = {
  list(platform?: string): Promise<UnifiedCommand[]> {
    return request<{ items: UnifiedCommand[] }>(`/commands${platformQuery(platform)}`).then(r => r?.items ?? [])
  },

  async get(id: string, platform?: string): Promise<UnifiedCommand | null> {
    try {
      return await request<UnifiedCommand>(`/commands/${id}${platformQuery(platform)}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },

  create(dto: CreateCommandDto, platform?: string): Promise<UnifiedCommand> {
    return request<UnifiedCommand>(`/commands${platformQuery(platform)}`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  update(id: string, dto: UpdateCommandDto, platform?: string): Promise<UnifiedCommand> {
    return request<UnifiedCommand>(`/commands/${id}${platformQuery(platform)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  delete(id: string, platform?: string): Promise<void> {
    return request<null>(`/commands/${id}${platformQuery(platform)}`, { method: 'DELETE' }).then(() => undefined)
  },

  projections(id: string, platform?: string): Promise<CommandProjectionItem[]> {
    return request<{ projections: CommandProjectionItem[] }>(`/commands/${id}/projections${platformQuery(platform)}`).then(
      r => r?.projections ?? [],
    )
  },
}
