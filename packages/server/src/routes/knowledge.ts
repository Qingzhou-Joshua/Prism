import type { FastifyInstance } from 'fastify'
import type { KnowledgeStore } from '@prism/core'
import type { FileHookStore } from '@prism/core'
import type { IngestKnowledgeDto, CreateKnowledgeEntryDto, GenerateProjectRuleDto, PublishGeneratedAssetDto } from '@prism/shared'

const KNOWLEDGE_HOOK_DESCRIPTION = 'Prism Knowledge Capture'

const TECH_KEYWORDS = [
  'function', 'error', 'fix', 'debug', 'import', 'class', 'const',
  'interface', 'type', 'async', 'await', 'return', 'throw',
]

const LANG_KEYWORDS = [
  'typescript', 'javascript', 'python', 'rust', 'golang', 'go',
  'react', 'vue', 'angular', 'svelte', 'nextjs', 'fastify', 'express',
  'node', 'deno', 'bun', 'kotlin', 'swift', 'java',
]

function extractTextContent(content: string | unknown[]): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (typeof block === 'string') return block
        if (block && typeof block === 'object' && 'text' in block && typeof (block as Record<string, unknown>).text === 'string') {
          return (block as Record<string, unknown>).text as string
        }
        return ''
      })
      .join(' ')
  }
  return ''
}

function mapDomain(text: string): string {
  const lower = text.toLowerCase()
  if (/typescript/.test(lower)) return 'typescript'
  if (/javascript/.test(lower)) return 'javascript'
  if (/python/.test(lower)) return 'python'
  if (/error|fix|debug/.test(lower)) return 'debugging'
  return 'general'
}

function extractTags(text: string): string[] {
  const lower = text.toLowerCase()
  return LANG_KEYWORDS.filter(kw => lower.includes(kw))
}

function extractSessionDate(sessionId?: string): string {
  if (sessionId) {
    const match = /(\d{4})-(\d{2})-(\d{2})/.exec(sessionId)
    if (match) return match[0]
  }
  return new Date().toISOString().slice(0, 10)
}

export async function registerKnowledgeRoutes(
  app: FastifyInstance,
  store: KnowledgeStore,
  hooksStores: Map<string, FileHookStore>,
): Promise<void> {

  // B4: GET /knowledge/profile
  app.get('/knowledge/profile', async () => {
    return store.getProfile()
  })

  // B4: PUT /knowledge/profile
  app.put<{ Body: Record<string, unknown> }>('/knowledge/profile', async (request) => {
    return store.updateProfile(request.body as Parameters<typeof store.updateProfile>[0])
  })

  // B4: GET /knowledge/entries
  app.get<{ Querystring: { domain?: string; projectPath?: string; since?: string } }>(
    '/knowledge/entries',
    async (request) => {
      const { domain, projectPath, since } = request.query
      const items = await store.listEntries({
        domain: domain || undefined,
        projectPath: projectPath || undefined,
        since: since || undefined,
      })
      return { items }
    },
  )

  // B4: GET /knowledge/entries/:id
  app.get<{ Params: { id: string } }>('/knowledge/entries/:id', async (request, reply) => {
    const entry = await store.getEntry(request.params.id)
    if (!entry) {
      reply.code(404)
      return { error: 'Entry not found' }
    }
    return entry
  })

  // B4: DELETE /knowledge/entries/:id
  app.delete<{ Params: { id: string } }>('/knowledge/entries/:id', async (request, reply) => {
    const deleted = await store.deleteEntry(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Entry not found' }
    }
    reply.code(204)
    return null
  })

  // B3: POST /knowledge/ingest
  app.post<{ Body: IngestKnowledgeDto }>('/knowledge/ingest', async (request, reply) => {
    // Safely extract transcript — optional chaining never throws, so we use Array.isArray guard
    const raw = request.body?.transcript
    const transcript: Array<{ role: string; content: string | unknown[] }> = Array.isArray(raw) ? raw : []

    // 计算对话轮次：filter role === 'user' 的条数
    const userTurns = transcript.filter(m => m.role === 'user').length
    if (userTurns < 2) {
      reply.code(202)
      return { status: 'skipped', reason: 'too_short' }
    }

    // 提取 assistant 消息文本
    const assistantTexts = transcript
      .filter(m => m.role === 'assistant')
      .map(m => extractTextContent(m.content))
      .filter(t => t.length > 0)

    const allText = assistantTexts.join('\n')

    // 判断技术含量
    const lower = allText.toLowerCase()
    const hasTechnicalContent =
      lower.includes('```') ||
      TECH_KEYWORDS.some(kw => lower.includes(kw))

    if (!hasTechnicalContent) {
      reply.code(202)
      return { status: 'skipped', reason: 'no_technical_content' }
    }

    // 生成 entry
    const lastAssistantText = assistantTexts[assistantTexts.length - 1] ?? ''
    const summary = lastAssistantText.slice(0, 200)
    const domain = mapDomain(allText)
    const tags = extractTags(allText)
    const sessionDate = extractSessionDate(request.body?.session_id)

    const dto: CreateKnowledgeEntryDto = {
      domain,
      summary,
      content: allText,
      tags,
      projectPath: request.body?.cwd,
      sessionDate,
    }

    const entry = await store.appendEntry(dto)

    reply.code(202)
    return { status: 'accepted', id: entry.id }
  })

  // B5: GET /knowledge/hook-status (read-only probe)
  app.get<{ Querystring: { platforms?: string } }>(
    '/knowledge/hook-status',
    async (request) => {
      const rawPlatforms = request.query.platforms
      const platforms = rawPlatforms
        ? rawPlatforms.split(',').map(s => s.trim()).filter(Boolean)
        : Array.from(hooksStores.keys())

      const result: Record<string, boolean> = {}

      for (const platformId of platforms) {
        const hookStore = hooksStores.get(platformId)
        if (!hookStore) {
          result[platformId] = false
          continue
        }
        const hooks = await hookStore.list()
        result[platformId] = hooks.some(
          h => h.eventType === 'Stop' && h.description === KNOWLEDGE_HOOK_DESCRIPTION,
        )
      }

      const configured = Object.values(result).filter(Boolean).length
      return {
        enabled: configured > 0,
        platforms: result,
      }
    },
  )

  // B5: POST /knowledge/setup-hook
  app.post<{ Body: { platforms?: string[] } }>('/knowledge/setup-hook', async (request) => {
    const platforms = request.body?.platforms ?? Array.from(hooksStores.keys())
    const configured: string[] = []
    const alreadyConfigured: string[] = []

    for (const platformId of platforms) {
      const hookStore = hooksStores.get(platformId)
      if (!hookStore) continue

      const hooks = await hookStore.list()
      const existing = hooks.find(
        h => h.eventType === 'Stop' && h.description === KNOWLEDGE_HOOK_DESCRIPTION,
      )

      if (existing) {
        alreadyConfigured.push(platformId)
        continue
      }

      await hookStore.create({
        eventType: 'Stop',
        matcher: '.*',
        description: KNOWLEDGE_HOOK_DESCRIPTION,
        actions: [
          {
            type: 'command',
            command: 'curl -s -X POST http://localhost:3001/knowledge/ingest -H "Content-Type: application/json" -d @- || true',
          },
        ],
      })
      configured.push(platformId)
    }

    return { configured, alreadyConfigured }
  })

  // B5: POST /knowledge/teardown-hook
  app.post<{ Body: { platforms?: string[] } }>('/knowledge/teardown-hook', async (request) => {
    const platforms = request.body?.platforms ?? Array.from(hooksStores.keys())
    const removed: string[] = []

    for (const platformId of platforms) {
      const hookStore = hooksStores.get(platformId)
      if (!hookStore) continue

      const hooks = await hookStore.list()
      const toRemove = hooks.filter(
        h => h.eventType === 'Stop' && h.description === KNOWLEDGE_HOOK_DESCRIPTION,
      )

      for (const h of toRemove) {
        await hookStore.delete(h.id)
        removed.push(platformId)
      }
    }

    return { removed }
  })

  // ─── Generated Assets ───────────────────────────────────────────────────────

  // GET /knowledge/generated
  app.get('/knowledge/generated', async () => {
    const items = await store.listGenerated()
    return { items }
  })

  // GET /knowledge/generated/:id
  app.get<{ Params: { id: string } }>('/knowledge/generated/:id', async (request, reply) => {
    const asset = await store.getGenerated(request.params.id)
    if (!asset) {
      reply.code(404)
      return { error: 'Generated asset not found' }
    }
    return asset
  })

  // DELETE /knowledge/generated/:id
  app.delete<{ Params: { id: string } }>('/knowledge/generated/:id', async (request, reply) => {
    const deleted = await store.deleteGenerated(request.params.id)
    if (!deleted) {
      reply.code(404)
      return { error: 'Generated asset not found' }
    }
    reply.code(204)
    return null
  })

  // POST /knowledge/generate/profile-rule
  app.post('/knowledge/generate/profile-rule', async () => {
    return store.generateProfileRule()
  })

  // POST /knowledge/generate/project-rule
  app.post<{ Body: GenerateProjectRuleDto }>('/knowledge/generate/project-rule', async (request, reply) => {
    try {
      return await store.generateProjectRule(request.body ?? {})
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.startsWith('No knowledge entries')) {
        reply.code(400)
        return { error: message }
      }
      throw err
    }
  })

  // POST /knowledge/generated/:id/publish
  app.post<{ Params: { id: string }; Body: PublishGeneratedAssetDto }>(
    '/knowledge/generated/:id/publish',
    async (request, reply) => {
      try {
        return await store.publishGeneratedAsset(request.params.id, request.body)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        reply.code(500)
        return { error: message }
      }
    },
  )
}
