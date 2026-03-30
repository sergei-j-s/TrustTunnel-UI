import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execAsync } from '../utils/exec.js'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.resolve(process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, '../../..', 'data'),
  'panel.json'
)
const SYSTEMD_SERVICE = `/etc/systemd/system/${config.trusttunnel.serviceName}-ui.service`

export async function panelSettingsRoutes(fastify) {
  // GET /api/settings/panel
  fastify.get('/api/settings/panel', { onRequest: [fastify.authenticate] }, async () => {
    const saved = await readPanelData()
    return {
      port: saved.port ?? config.server.port,
      host: saved.host ?? config.server.host,
      currentPort: config.server.port,
    }
  })

  // PUT /api/settings/panel
  fastify.put('/api/settings/panel', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { port } = request.body
    const parsed = parseInt(port, 10)

    if (!parsed || parsed < 1 || parsed > 65535) {
      return reply.code(400).send({ error: 'Port must be between 1 and 65535' })
    }

    const saved = await readPanelData()
    saved.port = parsed
    await writePanelData(saved)

    // Обновляем systemd unit, если он существует
    const systemdUpdated = await updateSystemdPort(parsed)

    // Перезапускаем после отправки ответа
    reply.send({ success: true, port: parsed, systemdUpdated, restarting: true })

    // Небольшая задержка чтобы ответ успел уйти
    setTimeout(async () => {
      if (systemdUpdated) {
        try {
          await execAsync('systemctl restart trusttunnel-ui')
          return
        } catch {}
      }
      // Fallback — завершаем процесс (process manager перезапустит)
      process.exit(0)
    }, 500)
  })
}

async function readPanelData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writePanelData(data) {
  const dir = path.dirname(DATA_FILE)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8')
}

async function updateSystemdPort(port) {
  if (!existsSync(SYSTEMD_SERVICE)) return false

  try {
    let content = await fs.readFile(SYSTEMD_SERVICE, 'utf8')

    if (content.includes('Environment=PORT=')) {
      content = content.replace(/Environment=PORT=\d+/, `Environment=PORT=${port}`)
    } else {
      // Добавляем строку перед ExecStart
      content = content.replace(
        /(\[Service\])/,
        `$1\nEnvironment=PORT=${port}`
      )
    }

    await fs.writeFile(SYSTEMD_SERVICE, content, 'utf8')
    await execAsync('systemctl daemon-reload')
    return true
  } catch {
    return false
  }
}
