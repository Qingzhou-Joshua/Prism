export type PlatformId = 'openclaw' | 'claude-code' | 'cursor' | 'codebuddy'

export interface PlatformCapabilities {
  rules: boolean
  profiles: boolean
  skills?: boolean
  agents?: boolean
  mcp?: boolean
}

export interface PlatformScanResult {
  id: PlatformId
  displayName: string
  detected: boolean
  configPath?: string
  message?: string
  capabilities: PlatformCapabilities
}
