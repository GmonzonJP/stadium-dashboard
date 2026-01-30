# Stadium Dashboard - Documentación de Infraestructura

## Resumen del Servidor

| Parámetro | Valor |
|-----------|-------|
| **Hostname** | `aisrv` |
| **OS** | Ubuntu 24.04 LTS (Kernel 6.8.0-71-generic) |
| **IP Interna** | `10.120.0.24/26` |
| **IP Externa** | `179.27.76.130` |
| **Puerto SSH** | `2224` |
| **Usuario** | `aisrvadmin` |

---

## Hardware

### CPU
| Especificación | Valor |
|----------------|-------|
| **Modelo** | Intel Xeon Gold 6426Y |
| **Sockets** | 2 |
| **Cores por Socket** | 24 |
| **Total Cores** | 48 |
| **Threads por Core** | 1 |
| **NUMA Nodes** | 2 (0-23, 24-47) |

### Memoria
| Especificación | Valor |
|----------------|-------|
| **Total RAM** | 188 GB |
| **RAM Disponible** | ~185 GB |
| **Swap** | 8 GB |

### Almacenamiento
| Montaje | Dispositivo | Tamaño | Uso |
|---------|-------------|--------|-----|
| `/` | `/dev/mapper/ubuntu--vg-ubuntu--lv` | 98 GB | 67% |

---

## Arquitectura de Servicios

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
│                           │                                      │
│                    179.27.76.130:2224 (SSH)                      │
│                    179.27.76.130:80 (HTTP)                       │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVIDOR aisrv                               │
│                    10.120.0.24 (LAN)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌──────────────────┐     ┌──────────────┐  │
│  │   NGINX     │────▶│ STADIUM-DASHBOARD │────▶│   OLLAMA     │  │
│  │   :80       │     │     :3000         │     │   :11434     │  │
│  │  (proxy)    │     │   (Next.js)       │     │ (qwen2.5:72b)│  │
│  └─────────────┘     └──────────────────┘     └──────────────┘  │
│                              │                                   │
│                              ▼                                   │
│                    ┌──────────────────┐                          │
│                    │   SQL SERVER     │                          │
│                    │   10.120.0.19    │                          │
│                    │   (anysys DB)    │                          │
│                    └──────────────────┘                          │
│                                                                  │
│                    ┌──────────────────┐                          │
│                    │  IMAGE SERVER    │                          │
│                    │   10.108.0.19    │                          │
│                    │   /Imagenes/     │                          │
│                    └──────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Servicios Detallados

### 1. Stadium Dashboard (Next.js + PM2)

| Parámetro | Valor |
|-----------|-------|
| **Ruta** | `/opt/stadium-dashboard` |
| **Script** | `.next/standalone/server.js` |
| **Puerto** | 3000 |
| **Gestor** | PM2 |
| **Node.js** | v18.20.8 |
| **Memoria Máx** | 2 GB |
| **Logs** | `/var/log/stadium/` |

**Configuración PM2** (`/opt/stadium-dashboard/ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'stadium-dashboard',
    script: '.next/standalone/server.js',
    cwd: '/opt/stadium-dashboard',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
      OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
      OLLAMA_MODEL: 'qwen2.5:72b',
      OLLAMA_HEADERS_TIMEOUT_MS: '300000',
      OLLAMA_MAX_TOKENS: '512',
      CHAT_MAX_CONTEXT_CHARS: '6000',
      CHAT_MAX_PRELOADED_CHARS: '4000'
    },
    max_memory_restart: '2G',
    error_file: '/var/log/stadium/error.log',
    out_file: '/var/log/stadium/output.log',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000
  }]
};
```

**Comandos PM2**:
```bash
pm2 status                      # Ver estado
pm2 logs stadium-dashboard      # Ver logs en tiempo real
pm2 restart stadium-dashboard   # Reiniciar
pm2 reload stadium-dashboard    # Reload sin downtime
pm2 stop stadium-dashboard      # Detener
pm2 monit                       # Monitor interactivo
```

---

### 2. Nginx (Reverse Proxy)

| Parámetro | Valor |
|-----------|-------|
| **Puerto** | 80 |
| **Config** | `/etc/nginx/sites-available/stadium-dashboard` |
| **Service** | `systemctl status nginx` |

**Configuración** (`/etc/nginx/sites-available/stadium-dashboard`):
```nginx
upstream stadium_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name _;

    # Proxy para imágenes de productos (servidor interno)
    location /images/ {
        proxy_pass http://10.108.0.19/Imagenes/;
        proxy_cache_valid 200 24h;
        add_header Cache-Control "public, max-age=86400";
    }

    # Aplicación Next.js
    location / {
        proxy_pass http://stadium_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Assets estáticos con cache largo
    location /_next/static {
        proxy_pass http://stadium_backend;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    client_max_body_size 10M;
    gzip on;
}
```

**Comandos Nginx**:
```bash
sudo systemctl status nginx     # Ver estado
sudo systemctl restart nginx    # Reiniciar
sudo nginx -t                   # Verificar configuración
sudo tail -f /var/log/nginx/error.log  # Ver errores
```

---

### 3. Ollama (LLM Server)

| Parámetro | Valor |
|-----------|-------|
| **Puerto** | 11434 (solo localhost) |
| **Modelo** | qwen2.5:72b (47 GB) |
| **Service** | `/etc/systemd/system/ollama.service` |
| **User** | ollama |

**Configuración del Servicio** (`/etc/systemd/system/ollama.service`):
```ini
[Unit]
Description=Ollama LLM Server (High Performance)
After=network-online.target

[Service]
Type=simple
User=ollama
Group=ollama
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_NUM_THREADS=38"
Environment="OLLAMA_NUM_PARALLEL=8"
Environment="OLLAMA_KEEP_ALIVE=24h"
Environment="OLLAMA_MAX_LOADED_MODELS=2"

[Install]
WantedBy=multi-user.target
```

**Comandos Ollama**:
```bash
sudo systemctl status ollama    # Ver estado
ollama list                     # Ver modelos instalados
ollama ps                       # Ver modelo cargado en memoria
curl http://127.0.0.1:11434/api/tags  # API health check
sudo journalctl -u ollama -f    # Ver logs
```

---

## Variables de Entorno

**Archivo**: `/opt/stadium-dashboard/.env.local`

```bash
# Base de Datos
DB_USER=sa
DB_PASSWORD=***
DB_SERVER=10.120.0.19
DB_DATABASE=anysys
DB_ENCRYPT=true

# Ollama LLM
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:72b

# JWT
JWT_SECRET=***

# App
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

---

## Puertos y Conectividad

| Puerto | Servicio | Acceso |
|--------|----------|--------|
| 80 | Nginx | Público |
| 2224 | SSH | Público |
| 3000 | Next.js | Interno (via Nginx) |
| 11434 | Ollama | Interno (localhost) |
| 1433 | SQL Server | Red interna (10.120.0.19) |

---

## Procedimiento de Despliegue

### Despliegue Manual (Actual)

1. **Conectar al servidor**:
```bash
ssh -p 2224 aisrvadmin@179.27.76.130
```

2. **Copiar código actualizado**:
```bash
# Desde máquina local
rsync -avz --exclude 'node_modules' --exclude '.next' \
  -e "ssh -p 2224" \
  ./stadium-dashboard/ \
  aisrvadmin@179.27.76.130:/opt/stadium-dashboard/
```

3. **En el servidor**:
```bash
cd /opt/stadium-dashboard
npm ci
npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
pm2 reload stadium-dashboard
```

### Rollback

```bash
# Mantener backup del build anterior
cp -r /opt/stadium-dashboard/.next /opt/stadium-dashboard/.next.backup

# Para rollback:
rm -rf /opt/stadium-dashboard/.next
mv /opt/stadium-dashboard/.next.backup /opt/stadium-dashboard/.next
pm2 reload stadium-dashboard
```

---

## Monitoreo

### Health Checks
```bash
# Dashboard
curl http://localhost:3000/login

# Ollama
curl http://127.0.0.1:11434/api/tags

# Nginx
curl http://localhost/login
```

### Logs
```bash
# PM2 / Next.js
pm2 logs stadium-dashboard
tail -f /var/log/stadium/output.log
tail -f /var/log/stadium/error.log

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Ollama
sudo journalctl -u ollama -f

# Sistema
dmesg -T | tail -20
```

### Recursos
```bash
htop                    # CPU/RAM en tiempo real
pm2 monit               # Monitor de PM2
df -h                   # Espacio en disco
free -h                 # Memoria
```

---

## Uso de Recursos Actual

| Componente | CPU | RAM | Disco |
|------------|-----|-----|-------|
| **qwen2.5:72b** | Variable (hasta 38 cores) | ~50 GB (cuando cargado) | 47 GB |
| **Stadium Dashboard** | <1% | ~144 MB | 778 MB (node_modules) |
| **Nginx** | <1% | ~45 MB | - |
| **Sistema** | 2-4 cores | ~3.5 GB | 63 GB usado |
| **Disponible** | ~44 cores | ~131 GB | ~31 GB |

---

## Contactos y Acceso

| Recurso | Dirección |
|---------|-----------|
| **Servidor SSH** | `ssh -p 2224 aisrvadmin@179.27.76.130` |
| **Dashboard Web** | `http://179.27.76.130/` |
| **SQL Server** | `10.120.0.19:1433` |
| **Images Server** | `10.108.0.19` |

---

## Notas Importantes

1. **No hay Git en producción**: El código se copia manualmente con rsync/scp
2. **No hay Docker**: El despliegue es con PM2 directamente
3. **Ollama solo escucha en localhost**: Seguridad para el modelo LLM
4. **Logs rotan automáticamente**: Configurado en logrotate
5. **El modelo qwen2.5:72b tarda ~30-60s** en cargar en memoria la primera vez
6. **Reinicio de Ollama** requiere esperar a que cargue el modelo nuevamente
