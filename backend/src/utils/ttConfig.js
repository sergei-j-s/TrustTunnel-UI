import fs from 'fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import TOML from '@iarna/toml'
import { config } from '../config.js'
import { execAsync } from './exec.js'

export async function readTomlFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return TOML.parse(content)
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

export async function writeTomlFile(filePath, data) {
  const content = TOML.stringify(data)
  await fs.writeFile(filePath, content, 'utf8')
}

export async function readCredentials() {
  try {
    const content = await fs.readFile(config.trusttunnel.credentialsFile, 'utf8')
    const users = []
    for (const line of content.trim().split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [username, password] = trimmed.split(':')
      if (username && password) users.push({ username, password })
    }
    return users
  } catch {
    return []
  }
}

export async function writeCredentials(users) {
  const lines = users.map((u) => `${u.username}:${u.password}`)
  await fs.writeFile(config.trusttunnel.credentialsFile, lines.join('\n') + '\n', 'utf8')
}

export async function generateClientConfig(username, address, format = 'deeplink') {
  try {
    const args = [
      config.trusttunnel.vpnConfig,
      config.trusttunnel.hostsConfig,
      '-c', username,
      '-a', address,
      '--format', format,
    ]
    const { stdout } = await execAsync(`${config.trusttunnel.endpointBinary} ${args.join(' ')}`)
    return stdout.trim()
  } catch (err) {
    throw new Error(`Failed to generate config: ${err.message}`)
  }
}

export async function isTrustTunnelInstalled() {
  return existsSync(config.trusttunnel.endpointBinary)
}

export async function installTrustTunnel() {
  const steps = []

  const tmpScript = '/tmp/tt_install.sh'
  await execAsync(
    `curl -fsSL https://raw.githubusercontent.com/TrustTunnel/TrustTunnel/refs/heads/master/scripts/install.sh -o ${tmpScript}`
  )
  const { stdout, stderr } = await execAsync(
    `yes | USER=$(id -un) bash ${tmpScript}`,
    { env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' } }
  )
  steps.push({ step: 'install_script', stdout, stderr })

  const serviceTemplate = `${config.trusttunnel.installDir}/trusttunnel.service.template`
  const serviceTarget = '/etc/systemd/system/trusttunnel.service'

  if (existsSync(serviceTemplate)) {
    const templateContent = readFileSync(serviceTemplate, 'utf8')
    writeFileSync(serviceTarget, templateContent, 'utf8')
    steps.push({ step: 'copy_service', target: serviceTarget })

    const { stdout: reloadOut } = await execAsync('systemctl daemon-reload')
    steps.push({ step: 'daemon_reload', stdout: reloadOut })

    const { stdout: enableOut, stderr: enableErr } = await execAsync(
      `systemctl enable --now ${config.trusttunnel.serviceName}`
    )
    steps.push({ step: 'enable_service', stdout: enableOut, stderr: enableErr })
  } else {
    steps.push({ step: 'copy_service', skipped: true, reason: `template not found: ${serviceTemplate}` })
  }

  return { steps, stdout, stderr }
}
