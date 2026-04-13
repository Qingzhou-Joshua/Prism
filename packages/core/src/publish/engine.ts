import { copyFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { nanoid } from 'nanoid'
import type { PlatformId, Revision, PublishedFile } from '@prism/shared'
import { NotFoundError } from '@prism/shared'
import type { RuleStore } from '../rules/store.js'
import type { ProfileStore } from '../profiles/store.js'
import { getPlatformRulesDir, ruleFileName } from './platform-paths.js'
import { projectRule } from '../rules/project.js'

export class PublishEngine {
  constructor(
    private readonly ruleStore: RuleStore,
    private readonly profileStore: ProfileStore,
    private readonly prismDir: string = join(homedir(), '.prism'),
    private readonly getPlatformDir: (platformId: PlatformId) => string = getPlatformRulesDir,
  ) {}

  async publish(profileId: string): Promise<Revision> {
    const profile = await this.profileStore.get(profileId)
    if (!profile) {
      throw new NotFoundError(`Profile not found: ${profileId}`)
    }

    const revisionId = nanoid()
    const publishedFiles: PublishedFile[] = []

    for (const platformId of (profile.targetPlatforms ?? [])) {
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
