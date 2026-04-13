import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { PlatformAdapter } from '@prism/core'
import type { ImportedRule, PlatformScanResult } from '@prism/shared'

const BASE_RESULT = {
  id: 'claude-code' as const,
  displayName: 'Claude Code',
  capabilities: { rules: true, profiles: true },
} satisfies Pick<PlatformScanResult, 'id' | 'displayName' | 'capabilities'>

async function resolveConfigPath(): Promise<string | null> {
  const home = process.env.HOME
  if (!home) return null

  const primaryPath = path.join(home, '.claude-internal')
  const fallbackPath = path.join(home, '.claude')

  try {
    await access(primaryPath)
    return primaryPath
  } catch {
    try {
      await access(fallbackPath)
      return fallbackPath
    } catch {
      return null
    }
  }
}

export const claudeCodeAdapter: PlatformAdapter = {
  ...BASE_RESULT,
  async scan() {
    const configPath = await resolveConfigPath()

    if (!configPath) {
      if (!process.env.HOME) {
        return {
          ...BASE_RESULT,
          detected: false,
          message: 'HOME environment variable is not available',
        }
      }
      return {
        ...BASE_RESULT,
        detected: false,
        message: 'Claude Code config not found at ~/.claude-internal or ~/.claude',
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

  async importRules(): Promise<ImportedRule[]> {
    const configPath = await resolveConfigPath()
    if (!configPath) return []

    const rulesPath = path.join(configPath, 'rules')
    try {
      const entries = await readdir(rulesPath, { withFileTypes: true })
      const mdFiles = entries.filter(e => e.isFile() && e.name.endsWith('.md'))

      const rules = await Promise.all(
        mdFiles.map(async (entry) => {
          const filePath = path.join(rulesPath, entry.name)
          const content = await readFile(filePath, 'utf-8')
          return {
            platformId: 'claude-code' as const,
            fileName: entry.name,
            content,
            filePath,
          }
        })
      )
      return rules
    } catch {
      return []
    }
  },
}
