import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tt_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tt_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; username: string }>('/auth/login', { username, password }),
  me: () => api.get<{ id: number; username: string }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/password', { currentPassword, newPassword }),
}

export const dashboardApi = {
  get: () => api.get('/dashboard'),
}

export const vpnUsersApi = {
  list: () => api.get('/vpn-users'),
  create: (data: Record<string, unknown>) => api.post('/vpn-users', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/vpn-users/${id}`, data),
  delete: (id: number) => api.delete(`/vpn-users/${id}`),
  resetTraffic: (id: number) => api.post(`/vpn-users/${id}/reset-traffic`),
}

export const serviceApi = {
  status: () => api.get('/service/status'),
  control: (action: 'start' | 'stop' | 'restart') => api.post(`/service/${action}`),
  install: () => api.post('/service/install'),
  logs: (lines = 200) => api.get(`/service/logs?lines=${lines}`),
}

export const setupApi = {
  status: () => api.get('/setup/status'),
  apply: (data: Record<string, unknown>) => api.post('/setup/apply', data),
  generateSelfsigned: (data?: { commonName?: string; days?: number }) =>
    api.post('/setup/generate-selfsigned', data || {}),
  checkCertbot: () => api.get('/setup/check-certbot'),
  certbot: (domain: string, email: string) => api.post('/setup/certbot', { domain, email }),
  existingCerts: () => api.get('/setup/existing-certs'),
}

export const configApi = {
  getVpn: () => api.get('/config/vpn'),
  updateVpn: (data: Record<string, unknown>) => api.put('/config/vpn', data),
  getHosts: () => api.get('/config/hosts'),
  updateHosts: (data: Record<string, unknown>) => api.put('/config/hosts', data),
  generateClient: (data: { vpnUserId: number; address: string; format: string }) =>
    api.post('/config/generate-client', data),
  listClientConfigs: () => api.get('/config/client-configs'),
  deleteClientConfig: (id: number) => api.delete(`/config/client-configs/${id}`),
}
