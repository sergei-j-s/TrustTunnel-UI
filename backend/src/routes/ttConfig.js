import { readTomlFile, writeTomlFile, generateClientConfig } from '../utils/ttConfig.js'
import { getDb } from '../db.js'
import { config } from '../config.js'

export async function configRoutes(fastify) {
  fastify.get('/api/config/vpn', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const data = await readTomlFile(config.trusttunnel.vpnConfig)
    if (!data) return reply.code(404).send({ error: 'vpn.toml not found' })
    return data
  })

  fastify.put('/api/config/vpn', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      await writeTomlFile(config.trusttunnel.vpnConfig, request.body)
      return { success: true }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  fastify.get('/api/config/hosts', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const data = await readTomlFile(config.trusttunnel.hostsConfig)
    if (!data) return reply.code(404).send({ error: 'hosts.toml not found' })
    return data
  })

  fastify.put('/api/config/hosts', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      await writeTomlFile(config.trusttunnel.hostsConfig, request.body)
      return { success: true }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  fastify.post('/api/config/generate-client', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { vpnUserId, address, format = 'deeplink' } = request.body
    if (!vpnUserId || !address) {
      return reply.code(400).send({ error: 'vpnUserId and address are required' })
    }

    const db = getDb()
    const user = db.prepare('SELECT * FROM vpn_users WHERE id = ?').get(vpnUserId)
    if (!user) return reply.code(404).send({ error: 'VPN user not found' })

    try {
      const configData = await generateClientConfig(user.username, address, format)

      db.prepare(`
        INSERT INTO client_configs (vpn_user_id, name, address, format, config_data)
        VALUES (?, ?, ?, ?, ?)
      `).run(vpnUserId, user.username, address, format, configData)

      return { config: configData, format }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  fastify.get('/api/config/client-configs', { onRequest: [fastify.authenticate] }, async () => {
    const db = getDb()
    return db.prepare(`
      SELECT cc.*, vu.username as vpn_username
      FROM client_configs cc
      LEFT JOIN vpn_users vu ON cc.vpn_user_id = vu.id
      ORDER BY cc.created_at DESC
    `).all()
  })

  fastify.delete('/api/config/client-configs/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const db = getDb()
    db.prepare('DELETE FROM client_configs WHERE id = ?').run(request.params.id)
    return { success: true }
  })
}
