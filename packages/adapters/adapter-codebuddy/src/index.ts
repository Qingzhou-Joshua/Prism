import { access, readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { ImportedSkill, PlatformAdapter } from '@prism/core'
import type { ImportedRule, PlatformScanResult } from '@prism/shared'

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

  async importRules(): Promise<ImportedRule[]> {
    const home = process.env.HOME
    if (!home) return []

    const rulesPath = path.join(home, '.codebuddy', 'rules')
    try {
      const entries = await readdir(rulesPath, { withFileTypes: true })
      const mdFiles = entries.filter(e => e.isFile() && e.name.endsWith('.md'))

      const rules = await Promise.all(
        mdFiles.map(async (entry) => {
          const filePath = path.join(rulesPath, entry.name)
          const content = await readFile(filePath, 'utf-8')
          return {
            platformId: 'codebuddy' as const,
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

  async importSkills(): Promise<ImportedSkill[]> {
    const skillsDir = path.join(homedir(), '.codebuddy', 'skills')
    let entries: string[]
    try {
      entries = await readdir(skillsDir)
    } catch {
      return []
    }
    const mdEntries = entries.filter((e) => e.endsWith('.md'))
    const skills: ImportedSkill[] = []
    for (const entry of mdEntries) {
      try {
        const content = await readFile(path.join(skillsDir, entry), 'utf-8')
        skills.push({ fileName: entry, content })
      } catch {
        // skip unreadable files
      }
    }
    return skills
  },
}
