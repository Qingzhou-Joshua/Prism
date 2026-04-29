import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createAdapterRegistry, DirRuleStore, FileProfileStore, DirSkillStore, DirAgentStore, IdeSettingsMcpStore, PublishEngine, FileRevisionStore, getPlatformRulesDir, getPlatformSkillsDir, getPlatformAgentsDir, getPlatformMcpSettingsPath, getPlatformCommandsDir, FileHookStore, DirCommandStore, RegistryStore, OverrideStore, FileWatcher, KnowledgeStore, GitSyncConfigStore, GitSyncStore, GitSyncService, resolveClaudeCodeBaseDir, setClaudeCodeBaseDir, claudeCodeBase } from '@prism/core'
import { codebuddyAdapter } from '@prism/adapter-codebuddy'
import { claudeCodeAdapter } from '@prism/adapter-claude-code'
import { openclawAdapter } from '@prism/adapter-openclaw'
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
import { registerKnowledgeRoutes } from './routes/knowledge.js'
import { registerRegistryRoutes } from './routes/registry.js'
import { registerOverridesRoutes } from './routes/overrides.js'
import { registerScanRegistryRoute } from './routes/scan-registry.js'
import { registerWatcherRoutes } from './routes/watcher.js'
import { registerGitSyncRoutes } from './routes/git-sync.js'
import type { PlatformId } from '@prism/shared'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'

const app = Fastify({ logger: true })

const registry = createAdapterRegistry([
  codebuddyAdapter,
  claudeCodeAdapter,
  openclawAdapter,
])

// Detect the Claude Code base dir (any ~/.claude* directory, preferring ~/.claude)
// and cache the result so all path functions return the correct directories.
setClaudeCodeBaseDir(await resolveClaudeCodeBaseDir())

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow any localhost origin (any port) and no-origin requests (curl, server-to-server)
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
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
  const augmented = items.map(item => {
    let rulesDir: string | undefined
    let skillsDir: string | undefined
    let agentsDir: string | undefined
    let commandsDir: string | undefined
    try { rulesDir = getPlatformRulesDir(item.id) } catch { /* unsupported */ }
    try { skillsDir = getPlatformSkillsDir(item.id) } catch { /* unsupported */ }
    const agentsDirResult = getPlatformAgentsDir(item.id)
    if (agentsDirResult) agentsDir = agentsDirResult
    try { commandsDir = getPlatformCommandsDir(item.id) } catch { /* unsupported */ }
    return { ...item, rulesDir, skillsDir, agentsDir, commandsDir }
  })
  return { items: augmented }
})

await registerScanRoutes(app, registry)

const registryStore = new RegistryStore()
const overrideStore = new OverrideStore()
const fileWatcher = new FileWatcher(registryStore)

const RULES_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy', 'openclaw']
const rulesStores = new Map<string, DirRuleStore>(
  RULES_PLATFORM_IDS.map(id => [id, new DirRuleStore(getPlatformRulesDir(id))]),
)
const rulesStore = rulesStores.get('claude-code')!
await registerRulesRoutes(app, rulesStores, registryStore)
await registerPlatformRulesRoutes(app, registry)

const profileStore = new FileProfileStore(join(homedir(), '.prism', 'profiles', 'profiles.json'))
await registerProfileRoutes(app, profileStore, rulesStore)

const revisionStore = new FileRevisionStore(
  join(homedir(), '.prism', 'revisions'),
  join(homedir(), '.prism', 'backups'),
)
const SKILLS_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy', 'openclaw']
const skillsStores = new Map<string, DirSkillStore>(
  SKILLS_PLATFORM_IDS.map(id => [id, new DirSkillStore(getPlatformSkillsDir(id))]),
)
const AGENTS_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy', 'openclaw']
const agentsStores = new Map<string, DirAgentStore>(
  AGENTS_PLATFORM_IDS.map(id => [id, new DirAgentStore(getPlatformAgentsDir(id)!)]),
)
const mcpStore = new IdeSettingsMcpStore()

const HOOKS_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy', 'openclaw']
const hooksStores = new Map<string, FileHookStore>(
  HOOKS_PLATFORM_IDS.map(id => {
    const base = id === 'claude-code'
      ? claudeCodeBase()
      : join(homedir(), `.${id}`)
    return [id, new FileHookStore(join(base, 'settings.json'), id)]
  }),
)

const COMMANDS_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy', 'openclaw']
const commandsStores = new Map<string, DirCommandStore>(
  COMMANDS_PLATFORM_IDS.map(id => [id, new DirCommandStore(getPlatformCommandsDir(id))]),
)

const publishEngine = new PublishEngine(
  rulesStore,
  profileStore,
  join(homedir(), '.prism'),
  getPlatformRulesDir,
  skillsStores.get('claude-code')!,
  getPlatformSkillsDir,
  agentsStores.get('claude-code')!,
  getPlatformAgentsDir,
  mcpStore,
  getPlatformMcpSettingsPath,
  hooksStores,
  commandsStores.get('claude-code')!,
  getPlatformCommandsDir,
  (filePath) => fileWatcher.suppressNext(filePath),
)
await registerPublishRoutes(app, publishEngine, revisionStore)
await registerRevisionRoutes(app, revisionStore)
await registerSkillsRoutes(app, skillsStores)
await registerAgentsRoutes(app, agentsStores)
await registerMcpRoutes(app, mcpStore, registry)
await registerHooksRoutes(app, hooksStores)
await registerCommandsRoutes(app, commandsStores)

const knowledgeStore = new KnowledgeStore(join(homedir(), '.prism', 'knowledge'))
await registerKnowledgeRoutes(app, knowledgeStore, hooksStores)

const REGISTRY_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy', 'openclaw']
const platformStoresMap = new Map(
  REGISTRY_PLATFORM_IDS.map(id => [
    id,
    {
      rules: rulesStores.get(id)!,
      skills: skillsStores.get(id)!,
      agents: agentsStores.get(id)!,
    }
  ])
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
