import { getSystemInfo, getNetworkStats } from '../utils/sysInfo.js'
import { getServiceStatus } from '../utils/systemd.js'
import { isTrustTunnelInstalled } from '../utils/ttConfig.js'
import { getDb } from '../db.js'
import { config } from '../config.js'

export async function dashboardRoutes(fastify) {
  fastify.get('/api/dashboard', { onRequest: [fastify.authenticate] }, async () => {
    const [sysInfo, serviceStatus, installed, networkStats] = await Promise.all([
      getSystemInfo(),
      getServiceStatus(config.trusttunnel.serviceName),
      isTrustTunnelInstalled(),
      getNetworkStats(),
    ])

    const db = getDb()
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM vpn_users').get()
    const activeUsers = db.prepare('SELECT COUNT(*) as count FROM vpn_users WHERE enabled = 1').get()

    return {
      system: sysInfo,
      service: serviceStatus,
      installed,
      network: networkStats,
      users: {
        total: totalUsers.count,
        active: activeUsers.count,
      },
    }
  })
}
