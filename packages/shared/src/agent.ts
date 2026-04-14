import type { PlatformId } from './platform.js'

export interface UnifiedAgent {
  id: string
  name: string
  description?: string
  content: string
  tools?: string[]
  model?: string
  tags: string[]
  targetPlatforms: PlatformId[]
  createdAt: string
  updatedAt: string
}

export interface CreateAgentDto {
  name: string
  description?: string
  content: string
  tools?: string[]
  model?: string
  tags?: string[]
  targetPlatforms: PlatformId[]
}

export type UpdateAgentDto = Partial<CreateAgentDto>

export interface ImportedAgent {
  fileName: string
  content: string
}
