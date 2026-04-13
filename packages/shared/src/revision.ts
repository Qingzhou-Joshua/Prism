import type { PlatformId } from './platform.js'

export interface PublishedFile {
  platformId: PlatformId
  filePath: string        // absolute path written to
  backupPath: string      // absolute path of backup (~/.prism/backups/{revisionId}/{platformId}/{filename})
  isNew: boolean          // true = file did not exist before publish; rollback deletes it
  ruleId: string
  ruleName: string
}

export interface Revision {
  id: string              // nanoid (also used as backups subdirectory name)
  profileId: string
  profileName: string
  publishedAt: string     // ISO 8601
  files: PublishedFile[]
}
