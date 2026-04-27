import type { FastifyInstance } from 'fastify'
import type { DirRuleStore, DirSkillStore, DirAgentStore, RegistryStore } from '@prism/core'
import { ruleToEntry, skillToEntry, agentToEntry } from '@prism/core'
import type { PlatformId } from '@prism/shared'

interface PlatformStores {
  rules: DirRuleStore
  skills: DirSkillStore
  agents: DirAgentStore
}

export async function registerScanRegistryRoute(
  app: FastifyInstance,
  platformStores: Map<PlatformId, PlatformStores>,
  registryStore: RegistryStore,
): Promise<void> {
  // POST /registry/scan
  app.post('/registry/scan', async (_, reply) => {
    let indexed = 0
    const errors: string[] = []

    for (const [platformId, stores] of platformStores) {
      try {
        const [rules, skills, agents] = await Promise.all([
          stores.rules.list(),
          stores.skills.list(),
          stores.agents.list(),
          // TODO(v1.2): index mcp servers from settings.json mcpServers field
          // TODO(v1.2): index hooks from settings.json hooks field
        ])
        await Promise.all([
          ...rules.map(r => registryStore.upsert(ruleToEntry(r, platformId))),
          ...skills.map(s => registryStore.upsert(skillToEntry(s, platformId))),
          ...agents.map(a => registryStore.upsert(agentToEntry(a, platformId))),
        ])
        indexed += rules.length + skills.length + agents.length
      } catch (err) {
        errors.push(`${platformId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    reply.code(errors.length > 0 ? 207 : 200)
    return { indexed, errors, scannedAt: new Date().toISOString() }
  })
}
