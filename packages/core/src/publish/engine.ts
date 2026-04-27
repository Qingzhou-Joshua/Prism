import { copyFile, mkdir, readFile, writeFile, stat, cp } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { nanoid } from 'nanoid'
import type { PlatformId, Revision, PublishedFile } from '@prism/shared'
import { NotFoundError } from '@prism/shared'
import type { RuleStore } from '../rules/store.js'
import type { ProfileStore } from '../profiles/store.js'
import type { SkillStore } from '../skills/store.js'
import type { AgentStore } from '../agents/store.js'
import type { McpStore } from '../mcp/store.js'
import type { HookStore } from '../hooks/store.js'
import { getPlatformRulesDir, ruleFileName, getPlatformSkillsDir, skillFileName, getPlatformAgentsDir, agentFileName, getPlatformMcpSettingsPath } from './platform-paths.js'
import { projectRule } from '../rules/project.js'

export class PublishEngine {
  constructor(
    private readonly ruleStore: RuleStore,
    private readonly profileStore: ProfileStore,
    private readonly prismDir: string = join(homedir(), '.prism'),
    private readonly getPlatformDir: (platformId: PlatformId) => string = getPlatformRulesDir,
    private readonly skillStore: SkillStore | null = null,
    private readonly getSkillsDir: (platformId: PlatformId) => string = getPlatformSkillsDir,
    private readonly agentStore: AgentStore | null = null,
    private readonly getAgentsDir: (platformId: PlatformId) => string | null = getPlatformAgentsDir,
    private readonly mcpStore: McpStore | null = null,
    private readonly getMcpSettingsPath: (platformId: PlatformId) => string | null = getPlatformMcpSettingsPath,
    private readonly hookStores: Map<string, HookStore> | null = null,
  ) {}

  async publish(profileId: string): Promise<Revision> {
    const profile = await this.profileStore.get(profileId)
    if (!profile) {
      throw new NotFoundError(`Profile not found: ${profileId}`)
    }

    const revisionId = nanoid()
    const publishedFiles: PublishedFile[] = []

    for (const platformId of (profile.targetPlatforms ?? [])) {
      // Write rule files
      for (const ruleId of (profile.ruleIds ?? [])) {
        const rule = await this.ruleStore.get(ruleId)
        if (!rule) continue

        const projection = projectRule(rule, platformId)
        if (projection.hidden || projection.content === null) continue

        const platformDir = this.getPlatformDir(platformId)
        const fileName = ruleFileName(rule.name)
        const targetPath = join(platformDir, fileName)

        let isNew = true
        let backupPath: string | undefined
        try {
          await stat(targetPath)
          isNew = false
          const backupDir = join(this.prismDir, 'backups', revisionId, platformId)
          await mkdir(backupDir, { recursive: true })
          backupPath = join(backupDir, fileName)
          await copyFile(targetPath, backupPath)
        } catch {
          // File does not exist — isNew stays true
        }

        await mkdir(platformDir, { recursive: true })
        await writeFile(targetPath, projection.content, 'utf-8')

        publishedFiles.push({
          platformId,
          filePath: targetPath,
          backupPath,
          isNew,
          ruleId: rule.id,
          ruleName: rule.name,
        })
      }

      // Write skill files
      if (this.skillStore) {
        for (const skillId of (profile.skillIds ?? [])) {
          const skill = await this.skillStore.get(skillId)
          if (!skill) continue

          let skillsDir: string
          try {
            skillsDir = this.getSkillsDir(platformId)
          } catch {
            // Platform does not support skills — skip
            continue
          }

          const dirName = skillFileName(skill.name)
          const skillDir = join(skillsDir, dirName)
          const targetPath = join(skillDir, 'SKILL.md')

          let isNew = true
          let backupPath: string | undefined
          try {
            await stat(skillDir)
            isNew = false
            const backupDir = join(this.prismDir, 'backups', revisionId, `${platformId}-skills`)
            await mkdir(backupDir, { recursive: true })
            const backupSkillDir = join(backupDir, dirName)
            await cp(skillDir, backupSkillDir, { recursive: true })
            backupPath = join(backupSkillDir, 'SKILL.md')
          } catch {
            // Directory does not exist — isNew stays true
          }

          await mkdir(skillDir, { recursive: true })
          await writeFile(targetPath, skill.content, 'utf-8')

          publishedFiles.push({
            platformId,
            filePath: skillDir,
            backupPath,
            isNew,
            skillId: skill.id,
            skillName: skill.name,
          })
        }
      }

      // Write agent files
      if (this.agentStore) {
        for (const agentId of (profile.agentIds ?? [])) {
          const agent = await this.agentStore.get(agentId)
          if (!agent) continue

          const agentsDir = this.getAgentsDir(platformId)
          if (!agentsDir) continue  // platform doesn't support agents

          const fileName = agentFileName(agent.name)
          const targetPath = join(agentsDir, fileName)

          let isNew = true
          let backupPath: string | undefined
          try {
            await stat(targetPath)
            isNew = false
            const backupDir = join(this.prismDir, 'backups', revisionId, `${platformId}-agents`)
            await mkdir(backupDir, { recursive: true })
            backupPath = join(backupDir, fileName)
            await copyFile(targetPath, backupPath)
          } catch {
            // File does not exist — isNew stays true
          }

          await mkdir(agentsDir, { recursive: true })
          await writeFile(targetPath, agent.content, 'utf-8')

          publishedFiles.push({
            platformId,
            filePath: targetPath,
            backupPath,
            isNew,
            agentId: agent.id,
            agentName: agent.name,
          })
        }
      }

      // Merge MCP server entries into platform settings.json
      if (this.mcpStore) {
        for (const mcpServerId of (profile.mcpServerIds ?? [])) {
          const server = await this.mcpStore.findById(mcpServerId)
          if (!server) continue

          // Only publish to platforms this server targets
          if (!server.targetPlatforms.includes(platformId)) continue

          const settingsPath = this.getMcpSettingsPath(platformId)
          if (!settingsPath) continue

          // Read existing settings.json (or empty object if missing/invalid)
          let settingsObj: Record<string, unknown> = {}
          let isNew = true
          let backupPath: string | undefined

          try {
            await stat(settingsPath)
            isNew = false
            // Backup existing file
            const backupDir = join(this.prismDir, 'backups', revisionId, `${platformId}-mcp`)
            await mkdir(backupDir, { recursive: true })
            backupPath = join(backupDir, 'settings.json')
            await copyFile(settingsPath, backupPath)
            // Read contents
            const raw = await readFile(settingsPath, 'utf-8')
            try {
              settingsObj = JSON.parse(raw) as Record<string, unknown>
            } catch {
              // Corrupted JSON — start fresh but keep backup
              settingsObj = {}
            }
          } catch {
            // File does not exist — isNew stays true, settingsObj stays {}
          }

          // Merge mcpServers key
          if (!settingsObj.mcpServers || typeof settingsObj.mcpServers !== 'object') {
            settingsObj.mcpServers = {}
          }
          const mcpServers = settingsObj.mcpServers as Record<string, unknown>
          mcpServers[server.name] = {
            command: server.command,
            args: server.args,
            ...(server.env ? { env: server.env } : {}),
          }

          // Ensure parent directory exists and write back
          await mkdir(join(settingsPath, '..'), { recursive: true })
          await writeFile(settingsPath, JSON.stringify(settingsObj, null, 2), 'utf-8')

          publishedFiles.push({
            platformId,
            filePath: settingsPath,
            backupPath,
            isNew,
            mcpServerId: server.id,
            mcpServerName: server.name,
          })
        }
      }

      // Record hooks associated with this profile's platform
      if (this.hookStores) {
        const hookStore = this.hookStores.get(platformId)
        if (hookStore) {
          for (const hookId of (profile.hookIds ?? [])) {
            const hook = await hookStore.get(hookId)
            if (!hook) continue
            // Hooks are already stored in the platform's settings.json via FileHookStore CRUD.
            // Here we only record the hook in the revision so it appears in publish history.
            publishedFiles.push({
              platformId,
              filePath: `[hook:${platformId}:${hook.eventType}]`,
              isNew: false,
              hookId: hook.id,
              hookName: hook.description ?? hook.matcher,
            })
          }
        }
      }
    }

    return {
      id: revisionId,
      profileId: profile.id,
      profileName: profile.name,
      publishedAt: new Date().toISOString(),
      files: publishedFiles,
    }
  }
}
