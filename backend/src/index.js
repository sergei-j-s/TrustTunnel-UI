import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

import { config } from './config.js'
import { getDb } from './db.js'
import { authRoutes } from './routes/auth.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { vpnUsersRoutes } from './routes/vpnUsers.js'
import { serviceRoutes } from './routes/service.js'
import { configRoutes } from './routes/ttConfig.js'
import { setupRoutes } from './routes/setup.js'
import { panelSettingsRoutes } from './routes/panelSettings.js'
import { readSavedPort } from './utils/panelPort.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({ logger: { level: 'info' } })

await fastify.register(fastifyCors, {
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true,
})

await fastify.register(fastifyJwt, {
  secret: config.jwt.secret,
  sign: { expiresIn: config.jwt.expiresIn },
})

fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Unauthorized' })
  }
})

getDb()

await fastify.register(authRoutes)
await fastify.register(dashboardRoutes)
await fastify.register(vpnUsersRoutes)
await fastify.register(serviceRoutes)
await fastify.register(configRoutes)
await fastify.register(setupRoutes)
await fastify.register(panelSettingsRoutes)

const distPath = join(__dirname, '../../frontend/dist')
if (existsSync(distPath)) {
  await fastify.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
  })
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api')) {
      reply.sendFile('index.html')
    } else {
      reply.code(404).send({ error: 'Not found' })
    }
  })
}

fastify.get('/api/health', async () => ({ status: 'ok', version: '1.0.0' }))

const savedPort = await readSavedPort(config.server.port)
const listenPort = savedPort

try {
  await fastify.listen({ host: config.server.host, port: listenPort })
  console.log(`TrustTunnel UI running on http://${config.server.host}:${listenPort}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
