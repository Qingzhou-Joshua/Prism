import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import type { ProfileStore } from '@prism/core'
import type { RuleStore } from '@prism/core'
import { projectRule, getPlatformRulesDir, ruleFileName } from '@prism/core'
import type { CreateProfileDto, UpdateProfileDto, PublishPreviewFile, PlatformId } from '@prism/shared'

const PLATFORM_DISPLAY_NAMES: Record<PlatformId, string> = {
  'claude-code': 'Claude Code',
  'codebuddy': 'CodeBuddy',
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const createProfileSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'ruleIds', 'targetPlatforms'],
    properties: {
      name:            { type: 'string', minLength: 1 },
      description:     { type: 'string' },
      ruleIds:         { type: 'array', items: { type: 'string' } },
      targetPlatforms: { type: 'array', items: { type: 'string' } },
    },
  },
}

const updateProfileSchema = {
  body: {
    type: 'object' as const,
    properties: {
      name:            { type: 'string', minLength: 1 },
      description:     { type: 'string' },
      ruleIds:         { type: 'array', items: { type: 'string' } },
      targetPlatforms: { type: 'array', items: { type: 'string' } },
    },
  },
}

export async function registerProfileRoutes(
  app: FastifyInstance,
  profileStore: ProfileStore,
  ruleStore: RuleStore,
): Promise<void> {
  // GET /profiles
  app.get('/profiles', async () => {
    const items = await profileStore.list()
    return { items }
  })

  // POST /profiles
  app.post<{ Body: CreateProfileDto }>(
    '/profiles',
    { schema: createProfileSchema },
    async (request, reply) => {
      const profile = await profileStore.create(request.body)
      reply.code(201)
      return profile
    },
  )

  // GET /profiles/:id
  app.get<{ Params: { id: string } }>('/profiles/:id', async (request, reply) => {
    const profile = await profileStore.get(request.params.id)
    if (!profile) {
      reply.code(404)
      return { error: 'Profile not found' }
    }
    return profile
  })

  // PUT /profiles/:id
  app.put<{ Params: { id: string }; Body: UpdateProfileDto }>(
    '/profiles/:id',
    { schema: updateProfileSchema },
    async (request, reply) => {
      const profile = await profileStore.update(request.params.id, request.body)
      if (!profile) {
        reply.code(404)
        return { error: 'Profile not found' }
      }
      return profile
    },
  )

  // DELETE /profiles/:id
  app.delete<{ Params: { id: string } }>('/profiles/:id', async (request, reply) => {
    const deleted = await profileStore.delete(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Profile not found' }
    }
    reply.code(204)
    return null
  })

  // GET /profiles/:id/preview
  app.get<{ Params: { id: string } }>(
    '/profiles/:id/preview',
    async (request, reply) => {
      const profile = await profileStore.get(request.params.id)
      if (!profile) {
        reply.code(404)
        return { error: 'Profile not found' }
      }

      // Load all rules referenced in the profile (skip missing ones)
      const rules = (
        await Promise.all(profile.ruleIds.map((ruleId) => ruleStore.get(ruleId)))
      ).filter((r): r is NonNullable<typeof r> => r !== null)

      // Build preview files: cross-join rules × targetPlatforms
      const files: PublishPreviewFile[] = await Promise.all(
        profile.targetPlatforms.flatMap((platformId) =>
          rules.map(async (rule) => {
            const projection = projectRule(rule, platformId)
            const fileName = ruleFileName(rule.name)
            const filePath = join(getPlatformRulesDir(platformId), fileName)
            const exists = await fileExists(filePath)
            return {
              platformId,
              platformDisplayName: PLATFORM_DISPLAY_NAMES[platformId],
              ruleId: rule.id,
              ruleName: rule.name,
              fileName,
              filePath,
              content: projection.content,
              fileExists: exists,
            } satisfies PublishPreviewFile
          }),
        ),
      )

      return {
        profileId: profile.id,
        profileName: profile.name,
        targetPlatforms: profile.targetPlatforms,
        files,
      }
    },
  )
}
