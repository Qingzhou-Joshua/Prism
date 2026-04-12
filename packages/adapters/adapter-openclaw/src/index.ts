import { access } from 'node:fs/promises'
import path from 'node:path'
import type { PlatformAdapter } from '@prism/core'
import type { PlatformScanResult } from '@prism/shared'

const BASE_RESULT = {
  id: 'openclaw' as const,
  displayName: 'OpenClaw',
  capabilities: { rules: true, profiles: true },
} satisfies Pick<PlatformScanResult, 'id' | 'displayName' | 'capabilities'>

export const openclawAdapter: PlatformAdapter = {
  id: 'openclaw',
  displayName: 'OpenClaw',
  capabilities: { rules: true, profiles: true },
  async scan() {
    const home = process.env.HOME

    if (!home) {
      return {
        ...BASE_RESULT,
        detected: false,
        message: 'HOME environment variable is not available',
      }
    }

    const configPath = path.join(home, '.openclaw')

    try {
      await access(configPath)
    } catch {
      return {
        ...BASE_RESULT,
        detected: false,
        message: `OpenClaw config directory not found at ${configPath}`,
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
        ? `OpenClaw detected at ${configPath} (rules directory found)`
        : `OpenClaw detected at ${configPath}`,
      rulesDetected,
    }
  },
}
