import { execAsync } from './exec.js'
import os from 'os'

export async function getSystemInfo() {
  const cpuUsage = await getCpuUsage()
  const mem = getMemoryInfo()
  const disk = await getDiskInfo()
  const uptime = os.uptime()

  return { cpuUsage, mem, disk, uptime }
}

function getMemoryInfo() {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  return {
    total: Math.round(total / 1024 / 1024),
    used: Math.round(used / 1024 / 1024),
    free: Math.round(free / 1024 / 1024),
    percent: Math.round((used / total) * 100),
  }
}

async function getCpuUsage() {
  try {
    const { stdout } = await execAsync(
      "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"
    )
    return parseFloat(stdout.trim()) || 0
  } catch {
    return 0
  }
}

async function getDiskInfo() {
  try {
    const { stdout } = await execAsync("df -BM / | tail -1 | awk '{print $2,$3,$4,$5}'")
    const [total, used, free, percent] = stdout.trim().split(/\s+/)
    return {
      total: parseInt(total),
      used: parseInt(used),
      free: parseInt(free),
      percent: parseInt(percent),
    }
  } catch {
    return { total: 0, used: 0, free: 0, percent: 0 }
  }
}

export async function getNetworkStats() {
  try {
    const { stdout } = await execAsync(
      "cat /proc/net/dev | grep -v 'lo:' | grep ':' | awk -F: '{print $1, $2}'"
    )
    const lines = stdout.trim().split('\n').filter(Boolean)
    const ifaces = []
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const name = parts[0]
      const rx = parseInt(parts[1]) || 0
      const tx = parseInt(parts[9]) || 0
      if (name && !name.startsWith('lo')) ifaces.push({ name, rx, tx })
    }
    return ifaces
  } catch {
    return []
  }
}
