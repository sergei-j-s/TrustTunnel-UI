import { createHash } from 'crypto'
import { getDb } from '../db.js'

export async function authRoutes(fastify) {
  fastify.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body
    const db = getDb()
    const hash = createHash('sha256').update(password).digest('hex')
    const user = db.prepare(
      'SELECT * FROM panel_users WHERE username = ? AND password_hash = ? AND is_active = 1'
    ).get(username, hash)

    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    db.prepare("UPDATE panel_users SET last_login = datetime('now') WHERE id = ?").run(user.id)

    const token = fastify.jwt.sign({ id: user.id, username: user.username })
    return { token, username: user.username }
  })

  fastify.get('/api/auth/me', { onRequest: [fastify.authenticate] }, async (request) => {
    return { username: request.user.username, id: request.user.id }
  })

  fastify.put('/api/auth/password', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return reply.code(400).send({ error: 'Invalid password data' })
    }
    const db = getDb()
    const currentHash = createHash('sha256').update(currentPassword).digest('hex')
    const user = db.prepare(
      'SELECT id FROM panel_users WHERE id = ? AND password_hash = ?'
    ).get(request.user.id, currentHash)
    if (!user) return reply.code(400).send({ error: 'Current password is incorrect' })

    const newHash = createHash('sha256').update(newPassword).digest('hex')
    db.prepare('UPDATE panel_users SET password_hash = ? WHERE id = ?').run(newHash, request.user.id)
    return { success: true }
  })
}
