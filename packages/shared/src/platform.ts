/**
 * Platform kinds Prism knows how to read/write.
 * A kind may have several discovered instances (e.g. ~/.claude and ~/.tclaude
 * are both `claude-code` instances).
 */
export type PlatformKind = 'claude-code' | 'codebuddy' | 'cursor' | 'codex' | 'opencode'

/**
 * Identifier of a discovered platform instance, e.g. `claude-code`,
 * `claude-code-tclaude`, `cursor`. The first/default instance of a kind uses
 * the bare kind name.
 */
export type PlatformId = string

export interface PlatformCapabilities {
  rules: boolean
  profiles: boolean
  skills?: boolean
  agents?: boolean
  mcp?: boolean
  hooks?: boolean
  commands?: boolean
  plugins?: boolean
}

export interface PlatformScanResult {
  id: PlatformId
  kind?: PlatformKind
  displayName: string
  detected: boolean
  configPath?: string
  message?: string
  capabilities: PlatformCapabilities
  rulesDetected?: boolean       // whether rules/ subdir was found
  rulesDir?: string             // absolute path to the rules directory
  skillsDir?: string            // absolute path to the skills directory
  agentsDir?: string            // absolute path to the agents directory
  commandsDir?: string          // absolute path to the commands directory
  mcpConfigPath?: string        // absolute path to the native MCP config file
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
