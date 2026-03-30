import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import TOML from '@iarna/toml'
import { config } from '../config.js'
import { execAsync } from '../utils/exec.js'
import { writeCredentials } from '../utils/ttConfig.js'
import { getDb } from '../db.js'

const ttDir = config.trusttunnel.installDir

export async function setupRoutes(fastify) {
  // GET /api/setup/status — проверяем наличие конфигов
  fastify.get('/api/setup/status', { onRequest: [fastify.authenticate] }, async () => {
    const vpnExists = existsSync(config.trusttunnel.vpnConfig)
    const hostsExists = existsSync(config.trusttunnel.hostsConfig)
    const binaryExists = existsSync(config.trusttunnel.endpointBinary)

    let vpnData = null
    if (vpnExists) {
      try {
        const raw = await fs.readFile(config.trusttunnel.vpnConfig, 'utf8')
        vpnData = TOML.parse(raw)
      } catch {}
    }

    return {
      installed: binaryExists,
      configured: vpnExists && hostsExists,
      vpnExists,
      hostsExists,
      vpnData,
    }
  })

  // POST /api/setup/apply — записываем все конфиги
  fastify.post('/api/setup/apply', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { network, tls, rules, initialUsers = [] } = request.body

    if (!network?.listenAddress) {
      return reply.code(400).send({ error: 'listenAddress is required' })
    }
    if (!tls?.certPath || !tls?.keyPath) {
      return reply.code(400).send({ error: 'certPath and keyPath are required' })
    }

    try {
      ensureDir(ttDir)

      // --- vpn.toml ---
      const vpnToml = {
        listen_address: network.listenAddress,
        credentials: config.trusttunnel.credentialsFile,
        rules: config.trusttunnel.rulesFile,
      }
      await fs.writeFile(config.trusttunnel.vpnConfig, TOML.stringify(vpnToml), 'utf8')

      // --- hosts.toml ---
      const hostsToml = {
        hosts: [
          {
            name: tls.serverName || extractHost(network.listenAddress),
            cert: tls.certPath,
            key: tls.keyPath,
          },
        ],
      }
      await fs.writeFile(config.trusttunnel.hostsConfig, TOML.stringify(hostsToml), 'utf8')

      // --- rules.toml ---
      const rulesEntries = (rules?.entries || []).filter(Boolean)
      const rulesContent = rulesEntries.length
        ? `rules = [\n${rulesEntries.map((r) => `  "${r}"`).join(',\n')}\n]\n`
        : 'rules = []\n'
      await fs.writeFile(config.trusttunnel.rulesFile, rulesContent, 'utf8')

      // --- credentials --- + sync DB
      if (initialUsers.length > 0) {
        const db = getDb()
        for (const u of initialUsers) {
          const existing = db.prepare('SELECT id FROM vpn_users WHERE username = ?').get(u.username)
          if (!existing) {
            db.prepare(
              'INSERT INTO vpn_users (username, password) VALUES (?, ?)'
            ).run(u.username, u.password)
          } else {
            db.prepare('UPDATE vpn_users SET password = ? WHERE username = ?').run(u.password, u.username)
          }
        }
        const allActive = db.prepare('SELECT username, password FROM vpn_users WHERE enabled = 1').all()
        await writeCredentials(allActive)
      } else if (!existsSync(config.trusttunnel.credentialsFile)) {
        await fs.writeFile(config.trusttunnel.credentialsFile, '', 'utf8')
      }

      return { success: true }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // POST /api/setup/generate-selfsigned — генерация самоподписанного сертификата
  fastify.post('/api/setup/generate-selfsigned', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { commonName = 'trusttunnel-server', days = 3650 } = request.body || {}

    const certDir = path.join(ttDir, 'certs')
    ensureDir(certDir)

    const certPath = path.join(certDir, 'server.crt')
    const keyPath = path.join(certDir, 'server.key')

    const subject = `/CN=${commonName}/O=TrustTunnel/C=US`

    try {
      await execAsync(
        `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" ` +
        `-days ${days} -nodes -subj "${subject}"`
      )
      return { certPath, keyPath }
    } catch (err) {
      return reply.code(500).send({ error: `openssl failed: ${err.message}` })
    }
  })

  // GET /api/setup/check-certbot — есть ли certbot
  fastify.get('/api/setup/check-certbot', { onRequest: [fastify.authenticate] }, async () => {
    try {
      const { stdout } = await execAsync('certbot --version')
      return { available: true, version: stdout.trim() }
    } catch {
      return { available: false }
    }
  })

  // POST /api/setup/certbot — получение Let's Encrypt сертификата
  fastify.post('/api/setup/certbot', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { domain, email } = request.body
    if (!domain || !email) {
      return reply.code(400).send({ error: 'domain and email are required' })
    }

    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`
    const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`

    try {
      const { stdout, stderr } = await execAsync(
        `certbot certonly --standalone --non-interactive --agree-tos ` +
        `--email ${email} -d ${domain} --http-01-port 80`,
        { timeout: 120000 }
      )
      return { success: true, certPath, keyPath, output: stdout + stderr }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // GET /api/setup/existing-certs — список сертификатов в /etc/letsencrypt
  fastify.get('/api/setup/existing-certs', { onRequest: [fastify.authenticate] }, async () => {
    const certs = []
    try {
      const liveDir = '/etc/letsencrypt/live'
      const dirs = await fs.readdir(liveDir)
      for (const d of dirs) {
        if (d === 'README') continue
        const certFile = path.join(liveDir, d, 'fullchain.pem')
        const keyFile = path.join(liveDir, d, 'privkey.pem')
        if (existsSync(certFile) && existsSync(keyFile)) {
          certs.push({ domain: d, certPath: certFile, keyPath: keyFile })
        }
      }
    } catch {}

    try {
      const certDir = path.join(ttDir, 'certs')
      const files = await fs.readdir(certDir)
      const crtFiles = files.filter((f) => f.endsWith('.crt'))
      for (const f of crtFiles) {
        const base = f.replace('.crt', '')
        const keyFile = path.join(certDir, `${base}.key`)
        if (existsSync(keyFile)) {
          certs.push({
            domain: `self-signed: ${f}`,
            certPath: path.join(certDir, f),
            keyPath: keyFile,
          })
        }
      }
    } catch {}

    return certs
  })
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function extractHost(listenAddress) {
  const parts = listenAddress.split(':')
  const host = parts[0]
  return host === '0.0.0.0' || host === '' ? 'localhost' : host
}
