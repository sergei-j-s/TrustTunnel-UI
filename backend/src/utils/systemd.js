import { execSync, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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
  const { stdout, stderr } = await execAsync(`systemctl ${action} ${serviceName}`)
  return { stdout, stderr }
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
