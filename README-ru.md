# TrustTunnel UI

Веб-панель управления [TrustTunnel](https://github.com/TrustTunnel/TrustTunnel) VPN-сервером на VPS.
Аналог [3x-ui](https://github.com/MHSanaei/3x-ui) для протокола TrustTunnel.

**Стек:** Node.js + Fastify · Vue 3 + UnoCSS · SQLite

---

## Возможности

- Дашборд с метриками CPU / RAM / Disk и статусом сервиса
- Управление VPN-пользователями — создание, редактирование, удаление, включение/отключение, лимит трафика, срок действия
- Генерация клиентских конфигов — Deep Link (`tt://`) и TOML-формат
- Редактирование `vpn.toml` и `hosts.toml` прямо в браузере
- Просмотр логов сервиса в реальном времени через `journalctl`
- Установка / обновление TrustTunnel endpoint из панели
- JWT-аутентификация со сменой пароля

---

## Требования

- Ubuntu 22.04 / Debian 12 (или любой дистрибутив с systemd)
- Node.js >= 18
- TrustTunnel endpoint, установленный в `/opt/trusttunnel` (опционально — можно установить из панели)

---

## Развёртывание на VPS

### Способ 1 — install.sh (рекомендуется)

```bash
# Клонировать репозиторий
git clone https://github.com/sergei-j-s/TrustTunnel-UI.git
cd TrustTunnel-UI

# Запустить установщик от root
sudo bash install.sh
```

Установщик автоматически:
1. Проверит / установит Node.js 22
2. Установит зависимости бэкенда
3. Соберёт фронтенд
4. Создаст и запустит systemd-сервис `trusttunnel-ui` на порту **8080**
5. Сгенерирует случайный JWT-секрет

После установки откройте `http://<IP-вашего-сервера>:8080` в браузере.

Данные по умолчанию: **admin / admin** — сразу после первого входа смените пароль.

---

### Способ 2 — Docker Compose

```bash
git clone https://github.com/sergei-j-s/TrustTunnel-UI.git
cd TrustTunnel-UI

# Сгенерировать JWT-секрет
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

docker compose up -d
```

Контейнер запускается на порту **8080** и монтирует `/opt/trusttunnel` с хост-машины, чтобы иметь доступ к файлам сервиса.

> **Важно:** `network_mode: host` и `privileged: true` необходимы для доступа к systemd и сервису TrustTunnel изнутри контейнера.

---

### Способ 3 — Вручную

```bash
git clone https://github.com/sergei-j-s/TrustTunnel-UI.git
cd TrustTunnel-UI

# Собрать фронтенд
cd frontend
npm install
npm run build
cd ..

# Установить зависимости бэкенда
cd backend
npm install --omit=dev

# Запустить
JWT_SECRET=$(openssl rand -hex 32) node src/index.js
```

---

## Переменные окружения

Все переменные опциональны и имеют значения по умолчанию.

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | `8080` | Порт панели |
| `HOST` | `0.0.0.0` | Адрес для прослушивания |
| `JWT_SECRET` | *(слабый дефолт)* | **Обязательно замените в продакшене** |
| `DB_PATH` | `./trusttunnel_ui.db` | Путь к базе данных SQLite |
| `TT_DIR` | `/opt/trusttunnel` | Директория установки TrustTunnel |
| `TT_VPN_CONFIG` | `/opt/trusttunnel/vpn.toml` | Путь к vpn.toml |
| `TT_HOSTS_CONFIG` | `/opt/trusttunnel/hosts.toml` | Путь к hosts.toml |
| `TT_CREDENTIALS` | `/opt/trusttunnel/credentials` | Путь к файлу учётных данных |
| `TT_BINARY` | `/opt/trusttunnel/trusttunnel_endpoint` | Путь к бинарнику endpoint |
| `TT_SERVICE` | `trusttunnel` | Имя systemd-сервиса |

При установке через systemd задайте переменные в файле `/etc/systemd/system/trusttunnel-ui.service`, при Docker — в файле `.env`.

---

## После установки: настройка TrustTunnel

Если TrustTunnel ещё не установлен на сервере, перейдите в **Settings → Install / Update** в панели — запустится официальный установочный скрипт.

После установки настройте endpoint через **Setup Wizard** прямо в веб-панели (**Setup Wizard** в боковом меню):

1. **Network** — адрес для прослушивания (обычно `0.0.0.0:443`)
2. **TLS Certificate** — выберите тип сертификата:
   - *Self-signed* — сгенерировать через OpenSSL прямо из панели (не поддерживается Flutter-клиентом)
   - *Let's Encrypt* — запросить сертификат через Certbot (нужен публичный домен и открытый порт 80)
   - *Existing* — указать путь к уже имеющимся файлам `.pem` / `.crt`
3. **Filtering Rules** — разрешить все подключения или задать правила по IP / TLS-префиксу
4. **Users** — добавить начальных VPN-пользователей
5. **Review & Apply** — просмотр и запись конфигов (`vpn.toml`, `hosts.toml`, `rules.toml`, `credentials`)

После применения конфигурации запустите сервис через **Dashboard**.

---

## Управление systemd-сервисом

```bash
# Статус
systemctl status trusttunnel-ui

# Перезапуск
systemctl restart trusttunnel-ui

# Логи в реальном времени
journalctl -u trusttunnel-ui -f

# Остановка
systemctl stop trusttunnel-ui

# Отключить автозапуск
systemctl disable trusttunnel-ui
```

---

## Обновление

### При установке через systemd

```bash
cd /path/to/trusttunnel-ui
git pull

cd frontend && npm install && npm run build && cd ..
cd backend && npm install --omit=dev && cd ..

systemctl restart trusttunnel-ui
```

### При использовании Docker

```bash
cd /path/to/trusttunnel-ui
git pull
docker compose up -d --build
```

---

## Настройка файрволла

Откройте порт панели (по умолчанию 8080). Для `ufw`:

```bash
ufw allow 8080/tcp
```

Настоятельно рекомендуется поставить панель за обратный прокси (nginx / caddy) с HTTPS и ограничить доступ по IP.

### Пример конфига nginx с HTTPS

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

Получить бесплатный сертификат Let's Encrypt:

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d panel.example.com
```

---

## Структура проекта

```
trusttunnel-ui/
├── backend/
│   ├── src/
│   │   ├── index.js          # Точка входа Fastify
│   │   ├── config.js         # Настройки через env-переменные
│   │   ├── db.js             # Схема SQLite и инициализация
│   │   ├── routes/
│   │   │   ├── auth.js       # Логин, JWT, смена пароля
│   │   │   ├── dashboard.js  # Системные метрики
│   │   │   ├── vpnUsers.js   # CRUD VPN-пользователей
│   │   │   ├── service.js    # Управление systemd
│   │   │   └── ttConfig.js   # Конфиги TOML и генерация клиент-конфигов
│   │   └── utils/
│   │       ├── systemd.js    # Обёртки над systemctl / journalctl
│   │       ├── ttConfig.js   # Чтение/запись TOML, credentials
│   │       └── sysInfo.js    # CPU / RAM / Disk / Network
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Login, Dashboard, Users, Configs, Logs, Settings
│   │   ├── components/       # Layout, Sidebar, Header, StatCard, ProgressBar
│   │   ├── stores/auth.ts    # Pinia store для авторизации
│   │   └── api/index.ts      # Axios-клиент с JWT
│   ├── uno.config.ts         # Тема и шорткаты UnoCSS
│   └── package.json
├── Dockerfile
├── docker-compose.yml
├── install.sh
├── README.md                 # Документация на английском
└── README-ru.md              # Документация на русском
```

---

## Лицензия

MIT
