import type { ImportedRule, PlatformCapabilities, PlatformId, PlatformScanResult } from '@prism/shared'

export interface ImportedSkill {
  fileName: string
  content: string  // raw file content including front-matter
}

export interface PlatformAdapter {
  id: PlatformId
  displayName: string
  capabilities: PlatformCapabilities
  scan: () => Promise<PlatformScanResult>
  importRules?: () => Promise<ImportedRule[]>
  importSkills?: () => Promise<ImportedSkill[]>
}
