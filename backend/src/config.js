export const config = {
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production-use-random-256bit-key',
    expiresIn: '24h',
  },
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '8080', 10),
  },
  db: {
    path: process.env.DB_PATH || './trusttunnel_ui.db',
  },
  trusttunnel: {
    installDir: process.env.TT_DIR || '/opt/trusttunnel',
    vpnConfig: process.env.TT_VPN_CONFIG || '/opt/trusttunnel/vpn.toml',
    hostsConfig: process.env.TT_HOSTS_CONFIG || '/opt/trusttunnel/hosts.toml',
    credentialsFile: process.env.TT_CREDENTIALS || '/opt/trusttunnel/credentials',
    rulesFile: process.env.TT_RULES || '/opt/trusttunnel/rules.toml',
    serviceName: process.env.TT_SERVICE || 'trusttunnel',
    endpointBinary: process.env.TT_BINARY || '/opt/trusttunnel/trusttunnel_endpoint',
  },
}
