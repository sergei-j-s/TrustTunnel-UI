#!/bin/bash
set -e

INSTALL_DIR="/opt/trusttunnel-ui"
PORT=${PORT:-8080}
NODE_MIN_VERSION=18
NGINX_URL=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }

# ═══════════════════════════════════════════════════════════════════════════════
# Функции
# ═══════════════════════════════════════════════════════════════════════════════

enable_nginx_site() {
  local conf_path="$1"
  local site_name
  site_name=$(basename "$conf_path")

  rm -f /etc/nginx/sites-enabled/default
  ln -sf "$conf_path" "/etc/nginx/sites-enabled/$site_name"
  nginx -t 2>/dev/null && systemctl reload nginx
  systemctl enable nginx >/dev/null 2>&1
}

setup_nginx_http() {
  local server_name="$1"
  local nginx_port="$2"
  local panel_port="$3"
  local conf_path="/etc/nginx/sites-available/trusttunnel-ui"

  cat > "$conf_path" << EOF
server {
    listen ${nginx_port};
    server_name ${server_name};

    location / {
        proxy_pass http://127.0.0.1:${panel_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

  enable_nginx_site "$conf_path"
  success "nginx configured: port $nginx_port → localhost:$panel_port"
  NGINX_URL="http://${server_name}:${nginx_port}"
}

setup_nginx_https() {
  local domain="$1"
  local panel_port="$2"
  local conf_path="/etc/nginx/sites-available/trusttunnel-ui"

  if ! command -v certbot &>/dev/null; then
    info "Installing certbot..."
    apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1
    success "certbot installed"
  fi

  # Временный HTTP-конфиг для ACME challenge
  cat > "$conf_path" << EOF
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${panel_port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

  enable_nginx_site "$conf_path"

  echo ""
  read -r -p "$(echo -e "${CYAN}Email for Let's Encrypt${NC}: ")" LE_EMAIL
  if [ -z "$LE_EMAIL" ]; then
    warn "Email not provided — staying on HTTP."
    NGINX_URL="http://${domain}"
    return
  fi

  info "Requesting Let's Encrypt certificate for $domain..."
  if certbot --nginx -d "$domain" --non-interactive --agree-tos --email "$LE_EMAIL" --redirect; then
    success "SSL certificate obtained, nginx configured with HTTPS"
    NGINX_URL="https://${domain}"
  else
    error "certbot failed. nginx stays on HTTP."
    NGINX_URL="http://${domain}"
  fi
}

setup_nginx() {
  if ! command -v nginx &>/dev/null; then
    info "Installing nginx..."
    apt-get install -y nginx >/dev/null 2>&1
    success "nginx installed"
  else
    success "nginx already installed"
  fi

  echo ""
  read -r -p "$(echo -e "${CYAN}Domain name${NC} (leave empty to use IP only): ")" DOMAIN
  DOMAIN=${DOMAIN:-""}

  read -r -p "$(echo -e "${CYAN}nginx listen port${NC} [443 with domain / 80 with IP]: ")" NGINX_PORT

  if [ -n "$DOMAIN" ]; then
    NGINX_PORT=${NGINX_PORT:-443}
    if [ "$NGINX_PORT" = "443" ]; then
      setup_nginx_https "$DOMAIN" "$PORT"
    else
      setup_nginx_http "$DOMAIN" "$NGINX_PORT" "$PORT"
    fi
  else
    NGINX_PORT=${NGINX_PORT:-80}
    local IP
    IP=$(hostname -I | awk '{print $1}')
    setup_nginx_http "$IP" "$NGINX_PORT" "$PORT"
  fi
}

print_summary() {
  local IP
  IP=$(hostname -I | awk '{print $1}')

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo -e "${GREEN}   Installation complete!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo ""

  if [ -n "$NGINX_URL" ]; then
    echo -e "  Panel URL (nginx): ${CYAN}${NGINX_URL}${NC}"
    echo -e "  Panel URL (direct): ${CYAN}http://${IP}:${PORT}${NC}"
  else
    echo -e "  Panel URL: ${CYAN}http://${IP}:${PORT}${NC}"
  fi

  echo -e "  Login:     ${CYAN}admin / admin${NC}"
  echo ""
  echo -e "  ${YELLOW}⚠  Change the default password after first login!${NC}"
  echo ""
  echo "  Manage service:"
  echo "    systemctl status trusttunnel-ui"
  echo "    systemctl restart trusttunnel-ui"
  echo "    journalctl -u trusttunnel-ui -f"
  if [ -n "$NGINX_URL" ]; then
    echo ""
    echo "  nginx config: /etc/nginx/sites-available/trusttunnel-ui"
  fi
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Установка
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${CYAN}"
echo "╔══════════════════════════════════╗"
echo "║     TrustTunnel UI Installer     ║"
echo "╚══════════════════════════════════╝"
echo -e "${NC}"

# Проверка root
if [ "$(id -u)" -ne 0 ]; then
  error "Run as root: sudo bash install.sh"
  exit 1
fi

# Node.js
if ! command -v node &>/dev/null; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
fi

NODE_VERSION=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]; then
  error "Node.js >= $NODE_MIN_VERSION required, found $NODE_VERSION"
  exit 1
fi
success "Node.js $(node -v)"

# Копирование файлов
info "Copying files to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r . "$INSTALL_DIR/"

# Backend
info "Installing backend dependencies..."
cd "$INSTALL_DIR/backend"
npm install --omit=dev --silent

# Frontend
info "Building frontend..."
cd "$INSTALL_DIR/frontend"
npm install --silent
npm run build --silent
success "Frontend built"

# Systemd сервис
JWT_SECRET=$(openssl rand -hex 32)

cat > /etc/systemd/system/trusttunnel-ui.service << EOF
[Unit]
Description=TrustTunnel UI Panel
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$(which node) src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=JWT_SECRET=$JWT_SECRET
Environment=DB_PATH=$INSTALL_DIR/data/trusttunnel_ui.db

[Install]
WantedBy=multi-user.target
EOF

mkdir -p "$INSTALL_DIR/data"
systemctl daemon-reload
systemctl enable --now trusttunnel-ui
success "trusttunnel-ui service started on port $PORT"

# Nginx (опционально)
echo ""
read -r -p "$(echo -e "${YELLOW}Setup nginx as reverse proxy?${NC} [y/N] ")" SETUP_NGINX
SETUP_NGINX=${SETUP_NGINX:-n}

if [[ "$SETUP_NGINX" =~ ^[Yy]$ ]]; then
  setup_nginx
fi

print_summary
