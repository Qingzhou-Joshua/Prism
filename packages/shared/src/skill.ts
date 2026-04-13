import type { PlatformId } from './platform.js'

export interface UnifiedSkill {
  id: string
  name: string
  description?: string
  content: string
  trigger?: string
  category?: string
  arguments?: string[]
  platformOverrides?: Partial<Record<PlatformId, {
    trigger?: string
    arguments?: string[]
  }>>
  tags: string[]
  targetPlatforms: PlatformId[]
  createdAt: string
  updatedAt: string
}

export type CreateSkillDto = Omit<UnifiedSkill, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateSkillDto = Partial<CreateSkillDto>
