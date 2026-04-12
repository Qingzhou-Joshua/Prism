import { access } from 'node:fs/promises'
import path from 'node:path'
import type { PlatformAdapter } from '@prism/core'

export const codebuddyAdapter: PlatformAdapter = {
  id: 'codebuddy',
  displayName: 'CodeBuddy',
  capabilities: { rules: true, profiles: true },
  async scan() {
    const home = process.env.HOME

    if (!home) {
      return {
        id: 'codebuddy',
        displayName: 'CodeBuddy',
        detected: false,
        message: 'HOME environment variable is not available',
        capabilities: {
          rules: true,
          profiles: true
        }
      }
    }

    const configPath = path.join(home, '.codebuddy')

    try {
      await access(configPath)

      return {
        id: 'codebuddy',
        displayName: 'CodeBuddy',
        detected: true,
        configPath,
        message: 'CodeBuddy config directory detected',
        capabilities: {
          rules: true,
          profiles: true
        }
      }
    } catch {
      return {
        id: 'codebuddy',
        displayName: 'CodeBuddy',
        detected: false,
        configPath,
        message: 'CodeBuddy config directory not found',
        capabilities: {
          rules: true,
          profiles: true
        }
      }
    }
  }
}