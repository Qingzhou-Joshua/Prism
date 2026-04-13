import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createAdapterRegistry, FileRuleStore } from '@prism/core'
import { openclawAdapter } from '@prism/adapter-openclaw'
import { codebuddyAdapter } from '@prism/adapter-codebuddy'
import { claudeCodeAdapter } from '@prism/adapter-claude-code'
import { registerScanRoutes } from './routes/scan.js'
import { registerRulesRoutes } from './routes/rules.js'
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
})

app.get('/health', async () => ({ status: 'ok' }))

app.get('/platforms', async () => {
  const items = await registry.scanAll()
  return { items }
})

await registerScanRoutes(app, registry)

const rulesStore = new FileRuleStore(join(homedir(), '.prism', 'rules', 'rules.json'))
await registerRulesRoutes(app, rulesStore)

const port = Number(process.env.PORT ?? 3001)
try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
