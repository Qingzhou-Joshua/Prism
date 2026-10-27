import type { PlatformId } from './platform.js'

export type McpTransport = 'stdio' | 'http' | 'sse'

export interface ImportedMcpServer {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  type?: McpTransport
  url?: string
  headers?: Record<string, string>
}

export interface McpServer {
  /** Stable id — the server key in the native config (URL-safe encoded). */
  id: string
  name: string
  /** Empty string for remote (http/sse) servers. */
  command: string
  args: string[]
  env?: Record<string, string>
  type?: McpTransport
  url?: string
  headers?: Record<string, string>
  /** false when the platform marks the server disabled. */
  enabled?: boolean
  description?: string
  targetPlatforms: PlatformId[]
  /** Platform instance whose config file this server lives in. */
  platformId?: PlatformId
  /** Native config file path this server was read from. */
  filePath?: string
  createdAt: string
  updatedAt: string
}

export type CreateMcpServerDto = Omit<McpServer, 'id' | 'createdAt' | 'updatedAt' | 'platformId' | 'filePath'>
export type UpdateMcpServerDto = Partial<CreateMcpServerDto>
