export type PlatformId = 'claude-code' | 'codebuddy'

export interface PlatformCapabilities {
  rules: boolean
  profiles: boolean
  skills?: boolean
  agents?: boolean
  mcp?: boolean
  hooks?: boolean
}

export interface PlatformScanResult {
  id: PlatformId
  displayName: string
  detected: boolean
  configPath?: string
  message?: string
  capabilities: PlatformCapabilities
  rulesDetected?: boolean       // whether rules/ subdir was found
  rulesDir?: string             // absolute path to the rules directory
  skillsDir?: string            // absolute path to the skills directory
  agentsDir?: string            // absolute path to the agents directory
}

export interface ImportedRule {
  platformId: PlatformId
  fileName: string
  content: string
  filePath: string
}

export interface ImportableRule {
  name: string      // derived from fileName: strip .md suffix, hyphens → spaces
  content: string   // full file content
  fileName: string  // original file name for display
}
