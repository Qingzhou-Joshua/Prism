import { access, readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { ImportedSkill, PlatformAdapter } from '@prism/core'
import type { ImportedAgent, ImportedMcpServer, ImportedRule, PlatformScanResult } from '@prism/shared'

const BASE_RESULT = {
  id: 'codebuddy' as const,
  displayName: 'CodeBuddy',
  capabilities: { rules: true, profiles: true, skills: true, agents: true, mcp: true, hooks: true },
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

  async importAgents(): Promise<ImportedAgent[]> {
    const agentsDir = path.join(homedir(), '.codebuddy', 'agents')
    let files: string[]
    try {
      files = await readdir(agentsDir)
    } catch {
      return []
    }
    const mdFiles = files.filter(f => f.endsWith('.md'))
    const results: ImportedAgent[] = []
    for (const fileName of mdFiles) {
      const filePath = path.join(agentsDir, fileName)
      try {
        const content = await readFile(filePath, 'utf-8')
        results.push({ fileName, content })
      } catch {
        // skip unreadable files
      }
    }
    return results
  },

  async importMcpServers(): Promise<ImportedMcpServer[]> {
    const mcpPath = path.join(homedir(), '.codebuddy', 'mcp.json')
    try {
      const raw = await readFile(mcpPath, 'utf-8')
      const mcpConfig = JSON.parse(raw) as Record<string, {
        command: string
        args?: string[]
        env?: Record<string, string>
      }>
      return Object.entries(mcpConfig).map(([name, config]) => ({
        name,
        command: config.command,
        args: config.args ?? [],
        env: config.env,
      }))
    } catch {
      return []
    }
  },
}
