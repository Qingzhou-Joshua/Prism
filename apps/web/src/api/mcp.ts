import type { McpServer, CreateMcpServerDto, UpdateMcpServerDto } from '@prism/shared'
import { request } from './client.js'

export interface McpScanResult {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

export const mcpApi = {
  list(): Promise<McpServer[]> {
    return request<{ items: McpServer[] }>('/mcp').then(r => r?.items ?? [])
  },

  async get(id: string): Promise<McpServer | null> {
    try {
      return await request<McpServer>(`/mcp/${id}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP 404')) return null
      throw e
    }
  },

  create(dto: CreateMcpServerDto): Promise<McpServer> {
    return request<McpServer>('/mcp', {
      method: 'POST',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  update(id: string, dto: UpdateMcpServerDto): Promise<McpServer> {
    return request<McpServer>(`/mcp/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }).then(r => r!)
  },

  delete(id: string): Promise<void> {
    return request<null>(`/mcp/${id}`, { method: 'DELETE' }).then(() => undefined)
  },

  projections(id: string): Promise<Record<string, unknown>> {
    return request<{ projections: Record<string, unknown> }>(`/mcp/${id}/projections`).then(
      r => r?.projections ?? {},
    )
  },

  scanPlatform(platformId: string): Promise<McpScanResult[]> {
    return request<{ servers: McpScanResult[] }>(`/platforms/${platformId}/mcp/scan`).then(
      r => r?.servers ?? [],
    )
  },

  importFromPlatform(
    platformId: string,
    servers: McpScanResult[],
  ): Promise<{ imported: number; items: McpServer[] }> {
    return request<{ imported: number; items: McpServer[] }>(
      `/platforms/${platformId}/mcp/import`,
      {
        method: 'POST',
        body: JSON.stringify({ servers }),
      },
    ).then(r => r ?? { imported: 0, items: [] })
  },
}
