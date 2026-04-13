import type { PlatformId } from './platform.js'

export interface Profile {
  id: string
  name: string
  description?: string
  ruleIds: string[]
  skillIds: string[]
  targetPlatforms: PlatformId[]
  createdAt: string
  updatedAt: string
}

export interface CreateProfileDto {
  name: string
  description?: string
  ruleIds: string[]
  skillIds: string[]
  targetPlatforms: PlatformId[]
}

export interface UpdateProfileDto {
  name?: string
  description?: string
  ruleIds?: string[]
  skillIds?: string[]
  targetPlatforms?: PlatformId[]
}

export interface PublishPreviewFile {
  platformId: PlatformId
  platformDisplayName: string
  ruleId: string
  ruleName: string
  fileName: string
  filePath: string
  content: string | null
  fileExists: boolean
}

export interface PublishPreview {
  profileId: string
  profileName: string
  targetPlatforms: PlatformId[]
  files: PublishPreviewFile[]
}
