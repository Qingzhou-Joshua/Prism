import { access } from 'node:fs/promises'
import path from 'node:path'
import type { PlatformAdapter } from '@prism/core'

export const openclawAdapter: PlatformAdapter = {
  id: 'openclaw',
  displayName: 'OpenClaw',
  async scan() {
    const home = process.env.HOME

    if (!home) {
      return {
        id: 'openclaw',
        displayName: 'OpenClaw',
        detected: false,
        message: 'HOME environment variable is not available',
        capabilities: {
          rules: true,
          profiles: true,
        },
      }
    }

    const configPath = path.join(home, '.openclaw')

    try {
      await access(configPath)
    } catch {
      return {
        id: 'openclaw',
        displayName: 'OpenClaw',
        detected: false,
        capabilities: {
          rules: true,
          profiles: true,
        },
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
      id: 'openclaw',
      displayName: 'OpenClaw',
      detected: true,
      configPath,
      message: rulesDetected
        ? `OpenClaw detected at ${configPath} (rules directory found)`
        : `OpenClaw detected at ${configPath}`,
      rulesDetected,
      capabilities: {
        rules: true,
        profiles: true,
      },
    }
  },
}