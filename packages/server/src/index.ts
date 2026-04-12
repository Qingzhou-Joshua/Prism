import Fastify from 'fastify'
import cors from '@fastify/cors'
import { scanPlatforms } from '@prism/core'
import { openclawAdapter } from '@prism/adapter-openclaw'
import { codebuddyAdapter } from '@prism/adapter-codebuddy'

const app = Fastify({ logger: true })

const start = async () => {
  try {
    await app.register(cors, {
      origin: true
    })

    app.get('/health', async () => {
      return { ok: true, service: 'prism-server' }
    })

    app.get('/platforms', async () => {
      const items = await scanPlatforms([openclawAdapter, codebuddyAdapter])

      return { items }
    })

    await app.listen({ port: 3001, host: '0.0.0.0' })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

start()
