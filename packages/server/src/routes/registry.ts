import { readFile, writeFile, unlink } from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import { computeChecksum } from '@prism/core'
import type { RegistryStore } from '@prism/core'

export async function registerRegistryRoutes(
  app: FastifyInstance,
  store: RegistryStore,
): Promise<void> {
  // GET /registry → { entries: RegistryEntry[], lastUpdated: string }
  app.get('/registry', async () => {
    const registry = await store.load()
    return { entries: registry.entries, lastUpdated: registry.lastUpdated }
  })

  // GET /registry/conflicts → { conflicts: ConflictGroup[] }
  app.get('/registry/conflicts', async () => {
    const conflicts = await store.getConflicts()
    return { conflicts }
  })

  // GET /registry/conflicts/:key/content → 读取冲突各 entry 的文件内容
  app.get<{ Params: { key: string } }>('/registry/conflicts/:key/content', async (request, reply) => {
    const { key } = request.params
    const conflicts = await store.getConflicts()
    const conflict = conflicts.find(c => c.key === key)
    if (!conflict) {
      reply.code(404)
      return { error: `Conflict key "${key}" not found` }
    }

    const entries = await Promise.all(
      conflict.entries.map(async (entry) => {
        let content = ''
        try {
          content = await readFile(entry.filePath, 'utf-8')
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
        }
        return { entry, content }
      }),
    )

    return { key, entries }
  })

  // POST /registry/conflicts/:key/resolve → 解决冲突
  app.post<{
    Params: { key: string }
    Body: { action: 'merge' | 'keep-one' | 'keep-both'; winnerId?: string; content?: string }
  }>('/registry/conflicts/:key/resolve', async (request, reply) => {
    const { key } = request.params
    const { action, winnerId, content } = request.body

    const conflicts = await store.getConflicts()
    const conflict = conflicts.find(c => c.key === key)
    if (!conflict) {
      reply.code(404)
      return { error: `Conflict key "${key}" not found` }
    }

    if (action === 'keep-one') {
      // 删除所有非 winner 的 entries（registry + 文件）
      for (const entry of conflict.entries) {
        if (entry.id === winnerId) continue
        await store.removeByPlatform(entry.id, entry.platformId)
        try {
          await unlink(entry.filePath)
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
        }
      }
    } else if (action === 'keep-both') {
      // 将所有 entries 的 scope 改为 'platform-only'
      for (const entry of conflict.entries) {
        await store.upsert({ ...entry, scope: 'platform-only' })
      }
    } else if (action === 'merge') {
      // 用 content 覆写所有 entries 的文件，scope 改为 'global'，更新 checksum
      const mergedContent = content ?? ''
      const checksum = computeChecksum(mergedContent)
      for (const entry of conflict.entries) {
        await writeFile(entry.filePath, mergedContent, 'utf-8')
        await store.upsert({ ...entry, scope: 'global', checksum })
      }
    }

    return { ok: true, action }
  })

  // DELETE /registry → reset (dev/testing only — clears all indexed entries)
  app.delete('/registry', async (_, reply) => {
    await store.reset()
    reply.code(204)
    return null
  })
}
