# Infraestructura de Producción

## Servidor Principal

### Especificaciones

| Componente | Especificación |
|------------|----------------|
| **Hostname** | aisrv |
| **IP Interna** | 10.120.0.24 |
| **IP Pública** | 179.27.76.130 |
| **Puerto SSH** | 2224 |
| **OS** | Ubuntu 24.04 LTS |
| **CPU** | Intel Xeon Gold 6426Y (48 cores, 2 sockets) |
| **RAM** | 192 GB |
| **Disco** | 200 GB SSD |

### Servicios Activos

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR AISRV                            │
│                    10.120.0.24                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │    Nginx     │ :80                                       │
│  │ (reverse     │ ────────────────┐                         │
│  │  proxy)      │                 │                         │
│  └──────────────┘                 │                         │
│                                   ▼                         │
│  ┌──────────────┐          ┌──────────────┐                │
│  │    PM2       │ ────────▶│ Stadium      │ :3000          │
│  │  (process    │          │ Dashboard    │                │
│  │   manager)   │          │ (Next.js)    │                │
│  └──────────────┘          └──────────────┘                │
│                                   │                         │
│  ┌──────────────┐                 │                         │
│  │   Ollama     │ :11434 ◀────────┘                        │
│  │ (qwen2.5:72b)│                                          │
│  └──────────────┘                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SQL Server
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR BD                               │
│                    10.120.0.19                               │
├─────────────────────────────────────────────────────────────┤
│  SQL Server 2016+                                           │
│  Database: anysys                                           │
│  Port: 1433                                                 │
└─────────────────────────────────────────────────────────────┘
```

## Directorios de la Aplicación

```
/opt/stadium-dashboard/           # Código fuente
├── .next/                        # Build de Next.js
├── node_modules/                 # Dependencias
├── public/                       # Assets estáticos
├── src/                          # Código fuente
├── .env.production               # Variables de entorno
└── ecosystem.config.js           # Configuración PM2

/var/log/stadium/                 # Logs de aplicación
├── error.log                     # Errores
├── output.log                    # Salida estándar
└── pm2.log                       # Logs de PM2

/etc/nginx/sites-available/       # Configuración Nginx
└── stadium.conf
```

## Configuración de PM2

**Archivo:** `/opt/stadium-dashboard/ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'stadium-dashboard',
    script: '.next/standalone/server.js',
    cwd: '/opt/stadium-dashboard',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/stadium/error.log',
    out_file: '/var/log/stadium/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

### Comandos PM2

```bash
# Iniciar
pm2 start ecosystem.config.js

# Reiniciar
pm2 restart stadium-dashboard

# Ver logs
pm2 logs stadium-dashboard

# Monitorear
pm2 monit

# Estado
pm2 status

# Guardar configuración para inicio automático
pm2 save
pm2 startup
```

## Configuración de Nginx

**Archivo:** `/etc/nginx/sites-available/stadium.conf`

```nginx
upstream stadium_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name _;

    # Logs
    access_log /var/log/nginx/stadium_access.log;
    error_log /var/log/nginx/stadium_error.log;

    # Proxy a Next.js
    location / {
        proxy_pass http://stadium_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Cache de assets estáticos
    location /_next/static {
        proxy_pass http://stadium_backend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Health check
    location /api/health {
        proxy_pass http://stadium_backend;
        access_log off;
    }

    # Compresión
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml;
}
```

## Configuración de Ollama

**Servicio systemd:** `/etc/systemd/system/ollama.service`

```ini
[Unit]
Description=Ollama Server
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="HOME=/usr/share/ollama"
Environment="OLLAMA_HOST=0.0.0.0"

[Install]
WantedBy=default.target
```

### Comandos Ollama

```bash
# Ver modelos instalados
ollama list

# Ejecutar modelo interactivamente
ollama run qwen2.5:72b

# Ver logs
journalctl -u ollama -f

# Reiniciar servicio
sudo systemctl restart ollama
```

## Variables de Entorno de Producción

**Archivo:** `/opt/stadium-dashboard/.env.production`

```env
# Database
DB_USER=sa
DB_PASSWORD=***
DB_SERVER=10.120.0.19
DB_DATABASE=anysys
DB_ENCRYPT=true

# Ollama LLM
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:72b

# JWT (generado con: openssl rand -base64 32)
JWT_SECRET=***

# App
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
VERSION=2.1.0
```

## Firewall

```bash
# Ver reglas actuales
sudo ufw status

# Reglas típicas
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (futuro)
sudo ufw allow 2224/tcp  # SSH
```

## Monitoreo

### Comandos útiles

```bash
# Uso de recursos
htop

# Uso de disco
df -h

# Memoria
free -h

# Conexiones de red
ss -tlnp

# Logs de sistema
journalctl -f

# Logs de aplicación
tail -f /var/log/stadium/*.log
```

## Backup

### Base de datos
Responsabilidad del DBA (servidor separado)

### Código
```bash
# Backup de código y configuración
tar -czvf stadium-backup-$(date +%Y%m%d).tar.gz \
  /opt/stadium-dashboard \
  --exclude='node_modules' \
  --exclude='.next'
```

## Despliegue

### Manual
```bash
cd /opt/stadium-dashboard
git pull origin main
npm install --production
npm run build
pm2 restart stadium-dashboard
```

### Con script
```bash
./scripts/deploy.sh
```

### Rollback
```bash
./scripts/deploy.sh rollback
```

## Acceso SSH

```bash
# Desde red externa
ssh -p 2224 usuario@179.27.76.130

# Desde red interna
ssh usuario@10.120.0.24
```

## URLs de Acceso

| Entorno | URL |
|---------|-----|
| Producción (externa) | http://179.27.76.130/ |
| Producción (interna) | http://10.120.0.24/ |
| Desarrollo local | http://localhost:3000/ |
