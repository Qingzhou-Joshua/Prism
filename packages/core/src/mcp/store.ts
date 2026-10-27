import type { McpServer, CreateMcpServerDto, UpdateMcpServerDto, ImportedMcpServer } from '@prism/shared'

export interface McpStore {
  findAll(): Promise<McpServer[]>
  findById(id: string): Promise<McpServer | null>
  create(dto: CreateMcpServerDto): Promise<McpServer>
  update(id: string, dto: UpdateMcpServerDto): Promise<McpServer | null>
  delete(id: string): Promise<boolean>
  importServers(servers: ImportedMcpServer[]): Promise<void>
}
