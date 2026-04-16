import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createAdapterRegistry, DirRuleStore, FileProfileStore, DirSkillStore, DirAgentStore, FileMcpStore, PublishEngine, FileRevisionStore, getPlatformRulesDir, getPlatformSkillsDir, getPlatformAgentsDir, FileHookStore } from '@prism/core'
import { codebuddyAdapter } from '@prism/adapter-codebuddy'
import { claudeCodeAdapter } from '@prism/adapter-claude-code'
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
import type { PlatformId } from '@prism/shared'
import { homedir } from 'node:os'
import { join } from 'node:path'

const app = Fastify({ logger: true })

const registry = createAdapterRegistry([
  codebuddyAdapter,
  claudeCodeAdapter,
])

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
    try { rulesDir = getPlatformRulesDir(item.id) } catch { /* unsupported */ }
    try { skillsDir = getPlatformSkillsDir(item.id) } catch { /* unsupported */ }
    const agentsDirResult = getPlatformAgentsDir(item.id)
    if (agentsDirResult) agentsDir = agentsDirResult
    return { ...item, rulesDir, skillsDir, agentsDir }
  })
  return { items: augmented }
})

await registerScanRoutes(app, registry)

const RULES_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy']
const rulesStores = new Map<string, DirRuleStore>(
  RULES_PLATFORM_IDS.map(id => [id, new DirRuleStore(getPlatformRulesDir(id))]),
)
const rulesStore = rulesStores.get('claude-code')!
await registerRulesRoutes(app, rulesStores)
await registerPlatformRulesRoutes(app, registry)

const profileStore = new FileProfileStore(join(homedir(), '.prism', 'profiles', 'profiles.json'))
await registerProfileRoutes(app, profileStore, rulesStore)

const revisionStore = new FileRevisionStore(
  join(homedir(), '.prism', 'revisions'),
  join(homedir(), '.prism', 'backups'),
)
const SKILLS_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy']
const skillsStores = new Map<string, DirSkillStore>(
  SKILLS_PLATFORM_IDS.map(id => [id, new DirSkillStore(getPlatformSkillsDir(id))]),
)
const AGENTS_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy']
const agentsStores = new Map<string, DirAgentStore>(
  AGENTS_PLATFORM_IDS.map(id => [id, new DirAgentStore(getPlatformAgentsDir(id)!)]),
)
const mcpStore = new FileMcpStore(join(homedir(), '.prism', 'mcp', 'servers.json'))

const publishEngine = new PublishEngine(rulesStore, profileStore, join(homedir(), '.prism'), getPlatformRulesDir, skillsStores.get('claude-code')!, getPlatformSkillsDir, agentsStores.get('claude-code')!, getPlatformAgentsDir)
await registerPublishRoutes(app, publishEngine, revisionStore)
await registerRevisionRoutes(app, revisionStore)
await registerSkillsRoutes(app, skillsStores)
await registerAgentsRoutes(app, agentsStores)
await registerMcpRoutes(app, mcpStore, registry)

const HOOKS_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy']
const hooksStores = new Map<string, FileHookStore>(
  HOOKS_PLATFORM_IDS.map(id => {
    const base = id === 'claude-code'
      ? join(homedir(), '.claude-internal')
      : join(homedir(), `.${id}`)
    return [id, new FileHookStore(join(base, 'settings.json'), id)]
  }),
)
await registerHooksRoutes(app, hooksStores)

const port = Number(process.env.PORT ?? 3001)
try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
