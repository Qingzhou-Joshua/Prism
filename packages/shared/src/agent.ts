import type { PlatformId } from './platform.js'

/** An agent file imported from a platform's agents directory */
export interface ImportedAgent {
  fileName: string
  content: string
}

export interface UnifiedAgent {
  id: string
  name: string
  description?: string
  content: string
  agentType?: string
  tools?: string[]
  model?: string
  tags: string[]
  targetPlatforms: PlatformId[]
  createdAt: string
  updatedAt: string
}

export type CreateAgentDto = Omit<UnifiedAgent, 'id' | 'createdAt' | 'updatedAt' | 'tags'> & {
  tags?: string[]
}

export type UpdateAgentDto = Partial<CreateAgentDto>
