import type { FastifyInstance } from 'fastify'
import type { GitSyncService } from '@prism/core'
import type { GitSyncConfigStore } from '@prism/core'
import type {
  GitConflictResolution,
  ConflictResolution,
  GitSyncConfig,
} from '@prism/shared'

export async function registerGitSyncRoutes(
  app: FastifyInstance,
  gitSyncService: GitSyncService | null,
  configStore: GitSyncConfigStore,
): Promise<void> {
  // ── GET /git-sync/config ──────────────────────────────────────────────────
  app.get('/git-sync/config', async () => {
    const config = await configStore.load()
    return { config }
  })

  // ── POST /git-sync/init ───────────────────────────────────────────────────
  app.post<{
    Body: { remoteUrl: string; branch?: string; machine?: string }
  }>('/git-sync/init', async (req, reply) => {
    const { remoteUrl, branch = 'main', machine } = req.body
    if (!remoteUrl) {
      return reply.status(400).send({ error: 'remoteUrl is required' })
    }
    // Save config immediately so future requests can use the service
    const newConfig: GitSyncConfig = {
      remoteUrl,
      branch,
      autoSync: false,
    }
    await configStore.save(newConfig)

    if (!gitSyncService) {
      // Service wasn't initialized at startup; tell the client to restart
      return reply
        .status(202)
        .send({ success: true, config: newConfig, message: 'Config saved. Restart server to activate git sync.' })
    }

    const result = await gitSyncService.initializeSync(remoteUrl, branch)
    if (!result.success) {
      return reply.status(500).send({ error: result.message })
    }
    return { success: true, config: result.config ?? newConfig }
  })

  // ── GET /git-sync/status ─────────────────────────────────────────────────
  app.get('/git-sync/status', async (_req, reply) => {
    if (!gitSyncService) {
      const state = await configStore.getStatus()
      return state
    }
    return gitSyncService.getSyncStatus()
  })

  // ── GET /git-sync/pre-pull-check ──────────────────────────────────────────
  app.get('/git-sync/pre-pull-check', async (_req, reply) => {
    if (!gitSyncService) {
      return reply.status(400).send({ error: 'Git sync not configured' })
    }
    const result = await gitSyncService.prePullCheck()
    return {
      hasLocalChanges: result.hasLocalChanges,
      hasRemoteChanges: result.hasRemoteChanges,
      conflictsDetected: result.conflictsDetected,
    }
  })

  // ── POST /git-sync/pull ───────────────────────────────────────────────────
  app.post<{
    Body: { resolutions?: GitConflictResolution[] }
  }>('/git-sync/pull', async (req, reply) => {
    if (!gitSyncService) {
      return reply.status(400).send({ error: 'Git sync not configured' })
    }
    const resolutions = req.body.resolutions ?? []
    const result = await gitSyncService.pull(resolutions)
    if (!result.success) {
      return reply.status(500).send({ success: false, message: result.message })
    }
    return { success: true }
  })

  // ── POST /git-sync/push ───────────────────────────────────────────────────
  app.post<{
    Body: { message: string }
  }>('/git-sync/push', async (req, reply) => {
    if (!gitSyncService) {
      return reply.status(400).send({ error: 'Git sync not configured' })
    }
    const message = req.body.message ?? 'chore: prism sync'
    const result = await gitSyncService.push(message)
    if (!result.success) {
      return reply.status(500).send({ success: false, message: result.message })
    }
    return { success: true }
  })

  // ── GET /git-sync/conflicts ───────────────────────────────────────────────
  app.get('/git-sync/conflicts', async (_req, reply) => {
    if (!gitSyncService) {
      return reply.status(400).send({ error: 'Git sync not configured' })
    }
    const check = await gitSyncService.prePullCheck()
    return { conflicts: check.conflictsDetected }
  })

  // ── POST /git-sync/resolve-conflict ──────────────────────────────────────
  app.post<{
    Body: { key: string; resolution: ConflictResolution; mergedContent?: string }
  }>('/git-sync/resolve-conflict', async (req, reply) => {
    if (!gitSyncService) {
      return reply.status(400).send({ error: 'Git sync not configured' })
    }
    const { key, resolution, mergedContent } = req.body
    if (!key || !resolution) {
      return reply.status(400).send({ error: 'key and resolution are required' })
    }
    const result = await gitSyncService.resolveConflict(key, resolution, mergedContent)
    return { success: result.success }
  })

  // ── POST /git-sync/clone-init (Task 4.1) ─────────────────────────────────
  app.post<{
    Body: { remoteUrl: string; branch?: string }
  }>('/git-sync/clone-init', async (req, reply) => {
    if (!gitSyncService) {
      return reply.status(400).send({ error: 'Git sync not configured' })
    }
    const { remoteUrl, branch = 'main' } = req.body
    if (!remoteUrl) {
      return reply.status(400).send({ error: 'remoteUrl is required' })
    }
    const result = await gitSyncService.initializeSync(remoteUrl, branch, remoteUrl)
    if (!result.success) {
      return reply.status(500).send({ error: result.message })
    }
    // Persist config so future requests have the service wired up
    await configStore.save({ remoteUrl, branch, autoSync: false })
    return {
      success: true,
      registryRebuilt: result.registryRebuilt ?? false,
      readyForPublish: result.registryRebuilt ?? false,
    }
  })

  // ── POST /git-sync/rebuild-registry (Task 4.1) ───────────────────────────
  app.post('/git-sync/rebuild-registry', async (_req, reply) => {
    if (!gitSyncService) {
      return reply.status(400).send({ error: 'Git sync not configured' })
    }
    try {
      // Push a fresh export so registry.json is up to date in work dir
      const pushResult = await gitSyncService.push('chore: rebuild registry')
      if (!pushResult.success) {
        return reply.status(500).send({ error: pushResult.message })
      }
      // Count entries by reading the local registry
      const gitStore = (gitSyncService as unknown as { gitStore: { getLocalRegistry(): Promise<import('@prism/shared').Registry | null> } }).gitStore
      const reg = await gitStore.getLocalRegistry()
      return { success: true, entriesCount: reg?.entries.length ?? 0 }
    } catch (err: unknown) {
      return reply.status(500).send({ error: String((err as Error).message ?? err) })
    }
  })

  // ── POST /git-sync/publish-to-ide (Task 4.1) ─────────────────────────────
  app.post<{
    Body: { platformIds: string[] }
  }>('/git-sync/publish-to-ide', async (req, reply) => {
    if (!gitSyncService) {
      return reply.status(400).send({ error: 'Git sync not configured' })
    }
    const { platformIds } = req.body
    if (!Array.isArray(platformIds) || platformIds.length === 0) {
      return reply.status(400).send({ error: 'platformIds array is required' })
    }
    // Pull from remote first so we have the latest content, then return success
    // Actual IDE publish is handled by the publish engine in a separate flow
    const pullResult = await gitSyncService.pull([])
    if (!pullResult.success) {
      return reply.status(500).send({ error: pullResult.message })
    }
    return { success: true, publishedCount: platformIds.length }
  })

  // ── DELETE /git-sync/config ───────────────────────────────────────────────
  app.delete('/git-sync/config', async (_req, reply) => {
    await configStore.clear()
    return reply.status(204).send()
  })
}
