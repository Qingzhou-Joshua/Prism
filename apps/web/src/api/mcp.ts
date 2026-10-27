import type { McpServer, CreateMcpServerDto, UpdateMcpServerDto, ImportedMcpServer } from '@prism/shared'
import { request } from './client.js'

function platformQuery(platform?: string): string {
  return platform ? `?platform=${encodeURIComponent(platform)}` : ''
}

export interface McpProjection {
  platformId: string
  key: string
  config: Record<string, unknown>
}

export const mcpApi = {
  list(platform?: string): Promise<McpServer[]> {
    return request<{ items: McpServer[] }>(`/mcp${platformQuery(platform)}`).then(r => r?.items ?? [])
  },

  async get(id: string, platform?: string): Promise<McpServer | null> {
    try {
      return await request<McpServer>(`/mcp/${encodeURIComponent(id)}${platformQuery(platform)}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },

  create(dto: CreateMcpServerDto, platform?: string): Promise<McpServer> {
    return request<McpServer>(`/mcp${platformQuery(platform)}`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  update(id: string, dto: UpdateMcpServerDto, platform?: string): Promise<McpServer> {
    return request<McpServer>(`/mcp/${encodeURIComponent(id)}${platformQuery(platform)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  delete(id: string, platform?: string): Promise<void> {
    return request<null>(`/mcp/${encodeURIComponent(id)}${platformQuery(platform)}`, { method: 'DELETE' }).then(() => undefined)
  },

  projections(id: string, platform?: string): Promise<McpProjection[]> {
    return request<{ projections: McpProjection[] }>(`/mcp/${encodeURIComponent(id)}/projections${platformQuery(platform)}`).then(
      r => r?.projections ?? [],
    )
  },

  scanPlatform(sourcePlatformId: string): Promise<ImportedMcpServer[]> {
    return request<{ servers: ImportedMcpServer[] }>(`/platforms/${sourcePlatformId}/mcp/scan`).then(
      r => r?.servers ?? [],
    )
  },

  /** Copy all servers from `sourcePlatformId` into `targetPlatform`'s config. */
  importFromPlatform(
    sourcePlatformId: string,
    targetPlatform?: string,
  ): Promise<{ imported: number; items: McpServer[] }> {
    return request<{ imported: number; items: McpServer[] }>(
      `/platforms/${sourcePlatformId}/mcp/import${platformQuery(targetPlatform)}`,
      { method: 'POST' },
    ).then(r => r ?? { imported: 0, items: [] })
  },
}
