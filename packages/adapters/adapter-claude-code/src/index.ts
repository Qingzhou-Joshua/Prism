import { access } from 'node:fs/promises'
import path from 'node:path'
import type { PlatformAdapter } from '@prism/core'
import type { PlatformScanResult } from '@prism/shared'

const BASE_RESULT = {
  id: 'claude-code' as const,
  displayName: 'Claude Code',
  capabilities: { rules: true, profiles: true },
} satisfies Pick<PlatformScanResult, 'id' | 'displayName' | 'capabilities'>

export const claudeCodeAdapter: PlatformAdapter = {
  ...BASE_RESULT,
  async scan() {
    const home = process.env.HOME

    if (!home) {
      return {
        ...BASE_RESULT,
        detected: false,
        message: 'HOME environment variable is not available',
      }
    }

    // Try ~/.claude-internal first, fall back to ~/.claude
    const primaryPath = path.join(home, '.claude-internal')
    const fallbackPath = path.join(home, '.claude')
    let configPath: string | undefined

    try {
      await access(primaryPath)
      configPath = primaryPath
    } catch {
      try {
        await access(fallbackPath)
        configPath = fallbackPath
      } catch {
        return {
          ...BASE_RESULT,
          detected: false,
          message: 'Claude Code config not found at ~/.claude-internal or ~/.claude',
        }
      }
    }

    // Config dir exists — check for rules/ subdir
    const rulesPath = path.join(configPath, 'rules')
    let rulesDetected = false
    try {
      await access(rulesPath)
      rulesDetected = true
    } catch {
      // rules/ not found, that's ok
    }

    return {
      ...BASE_RESULT,
      detected: true,
      configPath,
      message: rulesDetected
        ? `Claude Code detected at ${configPath} (rules directory found)`
        : `Claude Code detected at ${configPath}`,
      rulesDetected,
    }
  },
}
