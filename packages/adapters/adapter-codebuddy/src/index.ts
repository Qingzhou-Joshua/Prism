import { access } from 'node:fs/promises'
import path from 'node:path'
import type { PlatformAdapter } from '@prism/core'
import type { PlatformScanResult } from '@prism/shared'

const BASE_RESULT = {
  id: 'codebuddy' as const,
  displayName: 'CodeBuddy',
  capabilities: { rules: true, profiles: true },
} satisfies Pick<PlatformScanResult, 'id' | 'displayName' | 'capabilities'>

export const codebuddyAdapter: PlatformAdapter = {
  ...BASE_RESULT,
  async scan(): Promise<PlatformScanResult> {
    const home = process.env.HOME
    if (!home) {
      return {
        ...BASE_RESULT,
        detected: false,
        message: 'HOME environment variable is not available',
      }
    }
    const configPath = path.join(home, '.codebuddy')
    try {
      await access(configPath)
    } catch {
      return {
        ...BASE_RESULT,
        detected: false,
        message: `CodeBuddy config directory not found at ${configPath}`,
      }
    }
    const rulesPath = path.join(configPath, 'rules')
    let rulesDetected = false
    try {
      await access(rulesPath)
      rulesDetected = true
    } catch { /* rules/ not found */ }
    return {
      ...BASE_RESULT,
      detected: true,
      configPath,
      message: rulesDetected
        ? `CodeBuddy detected at ${configPath} (rules directory found)`
        : `CodeBuddy detected at ${configPath}`,
      rulesDetected,
    }
  },
}
