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
          profiles: true
        }
      }
    }

    const configPath = path.join(home, '.openclaw')

    try {
      await access(configPath)

      return {
        id: 'openclaw',
        displayName: 'OpenClaw',
        detected: true,
        configPath,
        message: 'OpenClaw config directory detected',
        capabilities: {
          rules: true,
          profiles: true
        }
      }
    } catch {
      return {
        id: 'openclaw',
        displayName: 'OpenClaw',
        detected: false,
        configPath,
        message: 'OpenClaw config directory not found',
        capabilities: {
          rules: true,
          profiles: true
        }
      }
    }
  }
}