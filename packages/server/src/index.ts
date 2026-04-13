import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createAdapterRegistry, FileRuleStore, FileProfileStore, FileSkillStore, PublishEngine, FileRevisionStore, getPlatformRulesDir } from '@prism/core'
import { openclawAdapter } from '@prism/adapter-openclaw'
import { codebuddyAdapter } from '@prism/adapter-codebuddy'
import { claudeCodeAdapter } from '@prism/adapter-claude-code'
import { registerScanRoutes } from './routes/scan.js'
import { registerRulesRoutes } from './routes/rules.js'
import { registerPlatformRulesRoutes } from './routes/platforms.js'
import { registerProfileRoutes } from './routes/profiles.js'
import { registerPublishRoutes } from './routes/publish.js'
import { registerRevisionRoutes } from './routes/revisions.js'
import { homedir } from 'node:os'
import { join } from 'node:path'

const app = Fastify({ logger: true })

const registry = createAdapterRegistry([
  openclawAdapter,
  codebuddyAdapter,
  claudeCodeAdapter,
])

await app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

app.get('/health', async () => ({ status: 'ok' }))

app.get('/platforms', async () => {
  const items = await registry.scanAll()
  return { items }
})

await registerScanRoutes(app, registry)

const rulesStore = new FileRuleStore(join(homedir(), '.prism', 'rules', 'rules.json'))
await registerRulesRoutes(app, rulesStore)
await registerPlatformRulesRoutes(app, registry)

const profileStore = new FileProfileStore(join(homedir(), '.prism', 'profiles', 'profiles.json'))
await registerProfileRoutes(app, profileStore, rulesStore)

const revisionStore = new FileRevisionStore(
  join(homedir(), '.prism', 'revisions'),
  join(homedir(), '.prism', 'backups'),
)
const skillStore = new FileSkillStore(join(homedir(), '.prism', 'skills', 'skills.json'))

const publishEngine = new PublishEngine(rulesStore, profileStore, join(homedir(), '.prism'), getPlatformRulesDir, skillStore)
await registerPublishRoutes(app, publishEngine, revisionStore)
await registerRevisionRoutes(app, revisionStore)

const port = Number(process.env.PORT ?? 3001)
try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
