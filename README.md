# TrustTunnel UI

Web panel for managing [TrustTunnel](https://github.com/TrustTunnel/TrustTunnel) VPN endpoint on a VPS.

**Stack:** Node.js + Fastify · Vue 3 + UnoCSS · SQLite

---

## Features

- Dashboard with CPU / RAM / Disk metrics and service status
- VPN user management (create, edit, delete, enable/disable, traffic limits, expiry)
- Generate client configs — Deep Link (`tt://`) and TOML format
- Edit `vpn.toml` and `hosts.toml` directly from the browser
- Live service logs via `journalctl`
- Install / update TrustTunnel endpoint from the panel
- JWT authentication with password change

---

## Requirements

- Ubuntu 22.04 / Debian 12 (or any systemd-based distro)
- Node.js >= 18
- TrustTunnel endpoint installed at `/opt/trusttunnel` (optional — can be installed from the panel)

---

## Deploy on VPS

### Option 1 — install.sh (recommended)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/trusttunnel-ui.git
cd trusttunnel-ui

# Run installer as root
sudo bash install.sh
```

The installer will:
1. Check / install Node.js 22
2. Install backend dependencies
3. Build the frontend
4. Create and start a `trusttunnel-ui` systemd service on port **8080**
5. Generate a random JWT secret automatically

After installation open `http://<your-server-ip>:8080` in the browser.

Default credentials: **admin / admin** — change the password immediately after first login.

---

### Option 2 — Docker Compose

```bash
git clone https://github.com/YOUR_USERNAME/trusttunnel-ui.git
cd trusttunnel-ui

# Generate a JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

docker compose up -d
```

The container runs on port **8080** and mounts `/opt/trusttunnel` from the host so it can manage the service files.

> **Note:** `network_mode: host` and `privileged: true` are required to access systemd and the TrustTunnel service from inside the container.

---

### Option 3 — Manual

```bash
git clone https://github.com/YOUR_USERNAME/trusttunnel-ui.git
cd trusttunnel-ui

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Install backend deps
cd backend
npm install --omit=dev

# Start
JWT_SECRET=$(openssl rand -hex 32) node src/index.js
```

---

## Environment Variables

All variables are optional and have defaults.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Panel listen port |
| `HOST` | `0.0.0.0` | Panel listen host |
| `JWT_SECRET` | *(weak default)* | **Change in production** |
| `DB_PATH` | `./trusttunnel_ui.db` | SQLite database path |
| `TT_DIR` | `/opt/trusttunnel` | TrustTunnel install directory |
| `TT_VPN_CONFIG` | `/opt/trusttunnel/vpn.toml` | Path to vpn.toml |
| `TT_HOSTS_CONFIG` | `/opt/trusttunnel/hosts.toml` | Path to hosts.toml |
| `TT_CREDENTIALS` | `/opt/trusttunnel/credentials` | Path to credentials file |
| `TT_BINARY` | `/opt/trusttunnel/trusttunnel_endpoint` | Path to endpoint binary |
| `TT_SERVICE` | `trusttunnel` | systemd service name |

Set variables in `/etc/systemd/system/trusttunnel-ui.service` (if using systemd install) or in `.env` (Docker).

---

## Post-install: configure TrustTunnel

If TrustTunnel is not yet installed on the server, go to **Settings → Install / Update** in the panel.

After installation configure the endpoint via the **Setup Wizard** in the web panel (sidebar → Setup Wizard):

1. **Network** — listen address (e.g. `0.0.0.0:443`)
2. **TLS Certificate** — choose a certificate type:
   - *Self-signed* — generate via OpenSSL directly from the panel (not supported by the Flutter client)
   - *Let's Encrypt* — request a certificate via Certbot (requires a public domain and open port 80)
   - *Existing* — provide paths to existing `.pem` / `.crt` files
3. **Filtering Rules** — allow all connections or define rules by IP / TLS prefix
4. **Users** — add initial VPN users
5. **Review & Apply** — review and write `vpn.toml`, `hosts.toml`, `rules.toml`, `credentials`

Then start the service from the **Dashboard**.

---

## Manage systemd service

```bash
# Status
systemctl status trusttunnel-ui

# Restart
systemctl restart trusttunnel-ui

# Logs
journalctl -u trusttunnel-ui -f

# Stop
systemctl stop trusttunnel-ui
```

---

## Update

### systemd install

```bash
cd /path/to/trusttunnel-ui
git pull

cd frontend && npm install && npm run build && cd ..
cd backend && npm install --omit=dev && cd ..

systemctl restart trusttunnel-ui
```

### Docker

```bash
cd /path/to/trusttunnel-ui
git pull
docker compose up -d --build
```

---

## Firewall

Open the panel port (default 8080). If using `ufw`:

```bash
ufw allow 8080/tcp
```

It is strongly recommended to put the panel behind a reverse proxy (nginx / caddy) with HTTPS and restrict access by IP.

### nginx reverse proxy example

```nginx
server {
    listen 443 ssl;
    server_name panel.example.com;

    ssl_certificate     /etc/letsencrypt/live/panel.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Project structure

```
trusttunnel-ui/
├── backend/
│   ├── src/
│   │   ├── index.js          # Fastify entry point
│   │   ├── config.js         # Settings via env vars
│   │   ├── db.js             # SQLite schema & init
│   │   ├── routes/
│   │   │   ├── auth.js       # Login, JWT, password change
│   │   │   ├── dashboard.js  # System metrics
│   │   │   ├── vpnUsers.js   # VPN user CRUD
│   │   │   ├── service.js    # systemd control
│   │   │   └── ttConfig.js   # TOML config & client gen
│   │   └── utils/
│   │       ├── systemd.js    # systemctl / journalctl wrappers
│   │       ├── ttConfig.js   # TOML read/write, credentials
│   │       └── sysInfo.js    # CPU / RAM / Disk / Network
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Login, Dashboard, Users, Configs, Logs, Settings
│   │   ├── components/       # Layout, Sidebar, Header, StatCard, ProgressBar
│   │   ├── stores/auth.ts    # Pinia auth store
│   │   └── api/index.ts      # Axios API client
│   ├── uno.config.ts         # UnoCSS theme & shortcuts
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── install.sh
```

---

## License

MIT
