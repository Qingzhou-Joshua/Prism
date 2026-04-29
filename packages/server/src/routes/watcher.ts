import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'
import type { RegistryStore } from '@prism/core'
import { computeChecksum } from '@prism/core'
import type { FileWatcher } from '@prism/core'
import type { WatcherChangeEvent } from '@prism/shared'

export async function registerWatcherRoutes(
  app: FastifyInstance,
  registryStore: RegistryStore,
  fileWatcher: FileWatcher,
): Promise<void> {
  // GET /watch — SSE 长连接
  app.get('/watch', async (request, reply) => {
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    raw.write(':ok\n\n')

    const send = (event: WatcherChangeEvent) => {
      if (!raw.writable) return
      raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    fileWatcher.on('change', send)

    const heartbeat = setInterval(() => {
      if (!raw.writable) {
        clearInterval(heartbeat)
        return
      }
      raw.write(':heartbeat\n\n')
    }, 30000)

    request.raw.on('close', () => {
      clearInterval(heartbeat)
      fileWatcher.off('change', send)
    })
  })

  // GET /registry/entries/:entryId/content
  app.get<{ Params: { entryId: string } }>(
    '/registry/entries/:entryId/content',
    async (request, reply) => {
      const entry = await registryStore.findById(request.params.entryId)
      if (!entry) {
        reply.code(404)
        return { error: 'Entry not found' }
      }

      let currentContent = ''
      let currentChecksum = ''
      try {
        currentContent = await readFile(entry.filePath, 'utf-8')
        currentChecksum = computeChecksum(currentContent)
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }

      return {
        entry,
        currentContent,
        registryChecksum: entry.checksum,
        currentChecksum,
      }
    },
  )

  // POST /registry/entries/:entryId/sync
  app.post<{ Params: { entryId: string } }>(
    '/registry/entries/:entryId/sync',
    async (request, reply) => {
      const entry = await registryStore.findById(request.params.entryId)
      if (!entry) {
        reply.code(404)
        return { error: 'Entry not found' }
      }

      let content: string
      try {
        content = await readFile(entry.filePath, 'utf-8')
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reply.code(422)
          return { error: 'File not found' }
        }
        throw err
      }

      fileWatcher.suppressNext(entry.filePath)

      const newChecksum = computeChecksum(content)
      const now = new Date().toISOString()
      await registryStore.upsert({
        ...entry,
        checksum: newChecksum,
        updatedAt: now,
        indexedAt: now,
      })

      return { ok: true, entryId: entry.id, newChecksum }
    },
  )
}
