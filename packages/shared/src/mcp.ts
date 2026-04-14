import type { PlatformId } from './platform.js'

export interface ImportedMcpServer {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  description?: string
  targetPlatforms: PlatformId[]
  createdAt: string
  updatedAt: string
}

export type CreateMcpServerDto = Omit<McpServer, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateMcpServerDto = Partial<CreateMcpServerDto>
