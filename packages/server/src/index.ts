import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createAdapterRegistry, createInstanceAdapter, discoverPlatformInstances, setPlatformInstances, DirRuleStore, FileProfileStore, DirSkillStore, DirAgentStore, NativeMcpStore, PluginStore, PublishEngine, FileRevisionStore, getPlatformRulesDir, getPlatformSkillsDir, getPlatformAgentsDir, getPlatformCommandsDir, FileHookStore, DirCommandStore, RegistryStore, OverrideStore, FileWatcher, KnowledgeStore, GitSyncConfigStore, GitSyncStore, GitSyncService } from '@prism/core'
import type { PlatformInstance } from '@prism/core'
import { registerScanRoutes } from './routes/scan.js'
import { registerRulesRoutes } from './routes/rules.js'
import { registerPlatformRulesRoutes } from './routes/platforms.js'
import { registerProfileRoutes } from './routes/profiles.js'
import { registerPublishRoutes } from './routes/publish.js'
import { registerRevisionRoutes } from './routes/revisions.js'
import { registerSkillsRoutes } from './routes/skills.js'
import { registerAgentsRoutes } from './routes/agents.js'
import { registerMcpRoutes } from './routes/mcp.js'
import { registerHooksRoutes } from './routes/hooks.js'
import { registerCommandsRoutes } from './routes/commands.js'
import { registerPluginsRoutes } from './routes/plugins.js'
import { registerKnowledgeRoutes } from './routes/knowledge.js'
import { registerRegistryRoutes } from './routes/registry.js'
import { registerOverridesRoutes } from './routes/overrides.js'
import { registerScanRegistryRoute } from './routes/scan-registry.js'
import { registerWatcherRoutes } from './routes/watcher.js'
import { registerGitSyncRoutes } from './routes/git-sync.js'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'

const app = Fastify({ logger: true })

// Discover every installed AI tool (Claude Code dirs matched by ~/.*claude*,
// CodeBuddy, Cursor, Codex, OpenCode) and cache the instances so all path
// helpers resolve against them.
const instances = await discoverPlatformInstances()
setPlatformInstances(instances)
app.log.info({ platforms: instances.map(p => `${p.id} → ${p.baseDir}`) }, 'discovered platforms')

const registry = createAdapterRegistry(instances.map(createInstanceAdapter))

/** Build `id → store` for every instance that has the given asset location. */
function storesFor<T>(pick: (p: PlatformInstance) => T | null): Map<string, T> {
  const map = new Map<string, T>()
  for (const p of instances) {
    const store = pick(p)
    if (store !== null) map.set(p.id, store)
  }
  return map
}

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow any localhost origin (any port) and no-origin requests (curl, server-to-server)
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'), false)
    }
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

app.get('/health', async () => ({ status: 'ok' }))

app.get('/platforms', async () => {
  const items = await registry.scanAll()
  return { items }
})

await registerScanRoutes(app, registry)

const registryStore = new RegistryStore()
const overrideStore = new OverrideStore()
const fileWatcher = new FileWatcher(registryStore)

const rulesStores = storesFor(p => (p.rulesDir ? new DirRuleStore(p.rulesDir, p.ruleExt) : null))
const primaryId = instances[0]?.id ?? 'claude-code'
const rulesStore = rulesStores.get(primaryId) ?? new DirRuleStore(join(homedir(), '.claude', 'rules'))
await registerRulesRoutes(app, rulesStores, registryStore)
await registerPlatformRulesRoutes(app, registry)

const profileStore = new FileProfileStore(join(homedir(), '.prism', 'profiles', 'profiles.json'))
await registerProfileRoutes(app, profileStore, rulesStore)

const revisionStore = new FileRevisionStore(
  join(homedir(), '.prism', 'revisions'),
  join(homedir(), '.prism', 'backups'),
)
const skillsStores = storesFor(p => (p.skillsDir ? new DirSkillStore(p.skillsDir) : null))
const agentsStores = storesFor(p => (p.agentsDir ? new DirAgentStore(p.agentsDir) : null))
const mcpStores = storesFor(p => (p.mcp ? new NativeMcpStore(p.mcp, p.id) : null))
const hooksStores = storesFor(p => (p.hooksSettingsPath ? new FileHookStore(p.hooksSettingsPath, p.id) : null))
const commandsStores = storesFor(p => (p.commandsDir ? new DirCommandStore(p.commandsDir) : null))
const pluginStores = storesFor(p => (p.plugins ? new PluginStore(p.plugins, p.id) : null))

const publishEngine = new PublishEngine(
  rulesStore,
  profileStore,
  join(homedir(), '.prism'),
  getPlatformRulesDir,
  skillsStores.get(primaryId) ?? null,
  getPlatformSkillsDir,
  agentsStores.get(primaryId) ?? null,
  getPlatformAgentsDir,
  mcpStores.get(primaryId) ?? null,
  (platformId) => (mcpStores.get(platformId) as NativeMcpStore | undefined) ?? null,
  hooksStores,
  commandsStores.get(primaryId) ?? null,
  getPlatformCommandsDir,
  (filePath) => fileWatcher.suppressNext(filePath),
)
await registerPublishRoutes(app, publishEngine, revisionStore)
await registerRevisionRoutes(app, revisionStore)
await registerSkillsRoutes(app, skillsStores)
await registerAgentsRoutes(app, agentsStores)
await registerMcpRoutes(app, mcpStores, registry)
await registerHooksRoutes(app, hooksStores)
await registerCommandsRoutes(app, commandsStores)
await registerPluginsRoutes(app, pluginStores, async (platformId) => {
  const count = async (store: { list(): Promise<unknown[]> } | undefined) => (store ? (await store.list()).length : undefined)
  const countMcp = async () => (mcpStores.get(platformId) ? (await mcpStores.get(platformId)!.findAll()).length : undefined)
  const [rules, skills, agents, commands, hooks, mcp] = await Promise.all([
    count(rulesStores.get(platformId)),
    count(skillsStores.get(platformId)),
    count(agentsStores.get(platformId)),
    count(commandsStores.get(platformId)),
    count(hooksStores.get(platformId)),
    countMcp().catch(() => undefined),
  ])
  return Object.fromEntries(
    Object.entries({ rules, skills, agents, commands, hooks, mcp }).filter(([, n]) => n !== undefined),
  ) as Record<string, number>
})

const knowledgeStore = new KnowledgeStore(join(homedir(), '.prism', 'knowledge'))
await registerKnowledgeRoutes(app, knowledgeStore, hooksStores)

const platformStoresMap = new Map(
  instances.map(p => [
    p.id,
    {
      rules: rulesStores.get(p.id),
      skills: skillsStores.get(p.id),
      agents: agentsStores.get(p.id),
    },
  ]),
)

await registerRegistryRoutes(app, registryStore)
await registerOverridesRoutes(app, overrideStore)
await registerScanRegistryRoute(app, platformStoresMap, registryStore, fileWatcher)
await registerWatcherRoutes(app, registryStore, fileWatcher)

const gitSyncConfigStore = new GitSyncConfigStore()
const gitConfig = await gitSyncConfigStore.load()
const gitSyncStore = gitConfig
  ? new GitSyncStore(join(homedir(), '.prism', 'git-sync'), homedir())
  : null
const gitSyncService = gitSyncStore
  ? new GitSyncService(gitSyncStore, registryStore, overrideStore, knowledgeStore, hostname())
  : null
await registerGitSyncRoutes(app, gitSyncService, gitSyncConfigStore)

const port = Number(process.env.PORT ?? 3001)
try {
  app.addHook('onClose', async () => {
    fileWatcher.stop()
  })
  await fileWatcher.start()
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
