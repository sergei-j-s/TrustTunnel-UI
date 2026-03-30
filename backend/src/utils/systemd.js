import { execSync, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Ищет реальное имя systemd-сервиса TrustTunnel если дефолтное не найдено.
 * Перебирает список всех сервисов и возвращает первый, содержащий 'trusttunnel'
 * (исключая сам UI-сервис trusttunnel-ui).
 */
export async function detectServiceName(fallback) {
  try {
    const { stdout } = await execAsync(
      'systemctl list-units --type=service --all --no-legend --no-pager'
    )
    const lines = stdout.trim().split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*(\S+\.service)/)
      if (!match) continue
      const name = match[1].replace('.service', '')
      if (
        name.toLowerCase().includes('trusttunnel') &&
        name !== 'trusttunnel-ui' &&
        name !== 'trusttunnel_ui'
      ) {
        return name
      }
    }
  } catch {}
  return fallback
}

export async function getServiceStatus(serviceName) {
  try {
    const { stdout } = await execAsync(`systemctl is-active ${serviceName}`)
    const active = stdout.trim() === 'active'

    let details = {}
    try {
      const { stdout: show } = await execAsync(
        `systemctl show ${serviceName} --property=ActiveState,SubState,MainPID,ExecMainStartTimestamp,Description`
      )
      show.trim().split('\n').forEach((line) => {
        const [k, ...v] = line.split('=')
        details[k] = v.join('=')
      })
    } catch {}

    return {
      active,
      state: details.ActiveState || (active ? 'active' : 'inactive'),
      subState: details.SubState || '',
      pid: details.MainPID ? parseInt(details.MainPID) : null,
      startedAt: details.ExecMainStartTimestamp || null,
    }
  } catch {
    return { active: false, state: 'inactive', subState: '', pid: null, startedAt: null }
  }
}

async function waitForServiceState(serviceName, expectedActive, timeoutMs = 5000, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs))
    const status = await getServiceStatus(serviceName)
    if (status.active === expectedActive) return status
    if (status.state === 'failed') return status
  }
  return getServiceStatus(serviceName)
}

export async function controlService(serviceName, action) {
  const allowed = ['start', 'stop', 'restart', 'reload']
  if (!allowed.includes(action)) throw new Error(`Invalid action: ${action}`)

  const runAction = async (name) => {
    const { stdout, stderr } = await execAsync(`systemctl ${action} ${name}`)
    return { stdout, stderr }
  }

  let result
  let effectiveName = serviceName
  try {
    result = await runAction(serviceName)
  } catch (err) {
    if (err.message.includes('not found') || err.stderr?.includes('not found')) {
      const detected = await detectServiceName(serviceName)
      if (detected !== serviceName) {
        result = await runAction(detected)
        effectiveName = detected
        result.detectedName = detected
      } else {
        throw err
      }
    } else {
      throw err
    }
  }

  if (action === 'start' || action === 'restart') {
    await waitForServiceState(effectiveName, true)
  } else if (action === 'stop') {
    await waitForServiceState(effectiveName, false)
  }

  return result
}

export async function enableService(serviceName) {
  const { stdout, stderr } = await execAsync(`systemctl enable ${serviceName}`)
  return { stdout, stderr }
}

export async function getServiceLogs(serviceName, lines = 200) {
  try {
    const { stdout } = await execAsync(
      `journalctl -u ${serviceName} -n ${lines} --no-pager --output=short-iso`
    )
    return stdout
  } catch {
    return ''
  }
}

export async function isSystemdAvailable() {
  try {
    execSync('systemctl --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
