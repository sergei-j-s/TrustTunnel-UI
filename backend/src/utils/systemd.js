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

export async function controlService(serviceName, action) {
  const allowed = ['start', 'stop', 'restart', 'reload']
  if (!allowed.includes(action)) throw new Error(`Invalid action: ${action}`)
  try {
    const { stdout, stderr } = await execAsync(`systemctl ${action} ${serviceName}`)
    return { stdout, stderr }
  } catch (err) {
    if (err.message.includes('not found')) {
      const detected = await detectServiceName(serviceName)
      if (detected !== serviceName) {
        const { stdout, stderr } = await execAsync(`systemctl ${action} ${detected}`)
        return { stdout, stderr, detectedName: detected }
      }
    }
    throw err
  }
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
