import { access, readdir, readFile } from 'node:fs/promises'
import path, { relative } from 'node:path'
import { glob } from 'glob'
import type { ImportedSkill, PlatformAdapter } from '@prism/core'
import type { ImportedAgent, ImportedMcpServer, ImportedRule, PlatformScanResult } from '@prism/shared'

const BASE_RESULT = {
  id: 'claude-code' as const,
  displayName: 'Claude Code',
  capabilities: { rules: true, profiles: true, skills: true, agents: true, mcp: true, hooks: true, commands: true },
} satisfies Pick<PlatformScanResult, 'id' | 'displayName' | 'capabilities'>

async function resolveConfigPath(): Promise<string | null> {
  const home = process.env.HOME
  if (!home) return null

  // Scan homedir for .claude* directories, preferring `.claude`
  try {
    const entries = await readdir(home, { withFileTypes: true })
    const claudeDirs = entries
      .filter(e => e.isDirectory() && /^\.claude/.test(e.name))
      .map(e => e.name)
    if (claudeDirs.includes('.claude')) return path.join(home, '.claude')
    if (claudeDirs.length > 0) return path.join(home, claudeDirs[0])
  } catch {
    // fallthrough
  }

  // Last resort: check if ~/.claude exists directly
  const defaultPath = path.join(home, '.claude')
  try {
    await access(defaultPath)
    return defaultPath
  } catch {
    return null
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
        message: 'Claude Code config not found at ~/.claude',
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

  async importSkills(): Promise<ImportedSkill[]> {
    const configPath = await resolveConfigPath()
    if (!configPath) return []
    const skillsDir = path.join(configPath, 'skills')

    const mdFiles = await glob('**/*.md', { cwd: skillsDir, absolute: true })
    const skills: ImportedSkill[] = []
    for (const filePath of mdFiles) {
      try {
        const content = await readFile(filePath, 'utf-8')
        skills.push({ fileName: relative(skillsDir, filePath), content })
      } catch {
        // skip unreadable files
      }
    }
    return skills
  },

  async importAgents(): Promise<ImportedAgent[]> {
    const configPath = await resolveConfigPath()
    if (!configPath) return []
    const agentsDir = path.join(configPath, 'agents')

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
    const configPath = await resolveConfigPath()
    if (!configPath) return []
    const settingsPath = path.join(configPath, 'settings.json')
    try {
      const raw = await readFile(settingsPath, 'utf8')
      const settings = JSON.parse(raw) as Record<string, unknown>
      const mcpServers = (settings.mcpServers ?? {}) as Record<string, {
        command: string
        args?: string[]
        env?: Record<string, string>
      }>
      return Object.entries(mcpServers).map(([name, config]) => ({
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
