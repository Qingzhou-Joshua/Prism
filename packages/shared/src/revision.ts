import type { PlatformId } from './platform.js'

export interface PublishedFile {
  platformId: PlatformId
  filePath: string        // absolute path written to
  backupPath?: string     // defined when isNew=false; path of backup copy
  isNew: boolean          // true = file did not exist before publish; rollback deletes it
  ruleId?: string
  ruleName?: string
  skillId?: string
  skillName?: string
  agentId?: string
  agentName?: string
  mcpServerId?: string
  mcpServerName?: string
  hookId?: string
  hookName?: string
}

export interface Revision {
  id: string              // nanoid (also used as backups subdirectory name)
  profileId: string
  profileName: string
  publishedAt: string     // ISO 8601
  files: PublishedFile[]
}
