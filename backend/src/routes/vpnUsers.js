import { getDb } from '../db.js'
import { readCredentials, writeCredentials } from '../utils/ttConfig.js'

export async function vpnUsersRoutes(fastify) {
  fastify.get('/api/vpn-users', { onRequest: [fastify.authenticate] }, async () => {
    const db = getDb()
    return db.prepare('SELECT * FROM vpn_users ORDER BY created_at DESC').all()
  })

  fastify.post('/api/vpn-users', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { username, password, trafficLimitGb = 0, expiresAt = null, note = '' } = request.body
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required' })
    }
    const db = getDb()
    const existing = db.prepare('SELECT id FROM vpn_users WHERE username = ?').get(username)
    if (existing) return reply.code(409).send({ error: 'User already exists' })

    const result = db.prepare(`
      INSERT INTO vpn_users (username, password, traffic_limit_gb, expires_at, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, password, trafficLimitGb, expiresAt, note)

    await syncCredentialsToFile(db)
    return db.prepare('SELECT * FROM vpn_users WHERE id = ?').get(result.lastInsertRowid)
  })

  fastify.put('/api/vpn-users/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params
    const { password, trafficLimitGb, expiresAt, enabled, note } = request.body
    const db = getDb()
    const user = db.prepare('SELECT * FROM vpn_users WHERE id = ?').get(id)
    if (!user) return reply.code(404).send({ error: 'User not found' })

    db.prepare(`
      UPDATE vpn_users SET
        password = COALESCE(?, password),
        traffic_limit_gb = COALESCE(?, traffic_limit_gb),
        expires_at = COALESCE(?, expires_at),
        enabled = COALESCE(?, enabled),
        note = COALESCE(?, note)
      WHERE id = ?
    `).run(
      password ?? null,
      trafficLimitGb ?? null,
      expiresAt ?? null,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      note ?? null,
      id,
    )

    await syncCredentialsToFile(db)
    return db.prepare('SELECT * FROM vpn_users WHERE id = ?').get(id)
  })

  fastify.delete('/api/vpn-users/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params
    const db = getDb()
    const user = db.prepare('SELECT id FROM vpn_users WHERE id = ?').get(id)
    if (!user) return reply.code(404).send({ error: 'User not found' })

    db.prepare('DELETE FROM vpn_users WHERE id = ?').run(id)
    await syncCredentialsToFile(db)
    return { success: true }
  })

  fastify.post('/api/vpn-users/:id/reset-traffic', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params
    const db = getDb()
    const user = db.prepare('SELECT id FROM vpn_users WHERE id = ?').get(id)
    if (!user) return reply.code(404).send({ error: 'User not found' })

    db.prepare('UPDATE vpn_users SET traffic_used_gb = 0 WHERE id = ?').run(id)
    return { success: true }
  })
}

async function syncCredentialsToFile(db) {
  const users = db.prepare('SELECT username, password FROM vpn_users WHERE enabled = 1').all()
  await writeCredentials(users)
}
