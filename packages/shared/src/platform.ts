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
  rulesDetected?: boolean       // whether rules/ subdir was found
}

export interface ImportedRule {
  platformId: PlatformId
  fileName: string
  content: string
  filePath: string
}

export interface ImportableRule {
  name: string      // 从文件名推导（去掉 .md 后缀，连字符转空格）
  content: string   // 文件完整内容
  fileName: string  // 原始文件名，用于展示
}
