import { getServiceStatus, controlService, getServiceLogs, enableService, detectServiceName } from '../utils/systemd.js'
import { isTrustTunnelInstalled, installTrustTunnel } from '../utils/ttConfig.js'
import { config } from '../config.js'

export async function serviceRoutes(fastify) {
  fastify.get('/api/service/status', { onRequest: [fastify.authenticate] }, async () => {
    const [status, installed] = await Promise.all([
      getServiceStatus(config.trusttunnel.serviceName),
      isTrustTunnelInstalled(),
    ])
    return { ...status, installed }
  })

  fastify.get('/api/service/name', { onRequest: [fastify.authenticate] }, async () => {
    const configured = config.trusttunnel.serviceName
    const detected = await detectServiceName(configured)
    return { configured, detected }
  })

  fastify.post('/api/service/:action', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { action } = request.params
    const allowed = ['start', 'stop', 'restart']
    if (!allowed.includes(action)) {
      return reply.code(400).send({ error: 'Invalid action' })
    }
    try {
      const result = await controlService(config.trusttunnel.serviceName, action)
      const effectiveName = result.detectedName || config.trusttunnel.serviceName
      const status = await getServiceStatus(effectiveName)
      return { success: true, status, serviceName: effectiveName }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  fastify.post('/api/service/enable', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      await enableService(config.trusttunnel.serviceName)
      return { success: true }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  fastify.get('/api/service/logs', { onRequest: [fastify.authenticate] }, async (request) => {
    const lines = parseInt(request.query.lines || '200', 10)
    const logs = await getServiceLogs(config.trusttunnel.serviceName, lines)
    return { logs }
  })

  fastify.post('/api/service/install', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const installed = await isTrustTunnelInstalled()
    if (installed) return reply.code(409).send({ error: 'TrustTunnel is already installed' })
    try {
      const result = await installTrustTunnel()
      return { success: true, output: result.stdout }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })
}
