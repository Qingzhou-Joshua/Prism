import type { PlatformId } from './platform.js'

export interface UnifiedCommand {
  id: string
  name: string
  description?: string
  content: string
  tags: string[]
  targetPlatforms: PlatformId[]
  createdAt: string
  updatedAt: string
  filePath?: string
}

export type CreateCommandDto = Omit<UnifiedCommand, 'id' | 'createdAt' | 'updatedAt' | 'filePath'>
export type UpdateCommandDto = Partial<CreateCommandDto>
