# Stadium Dashboard - Guía de Despliegue en Ubuntu Linux

## Índice

1. [Requisitos del Sistema](#1-requisitos-del-sistema)
2. [Preparación del Servidor](#2-preparación-del-servidor)
3. [Instalación de Node.js](#3-instalación-de-nodejs)
4. [Instalación de Ollama (LLM)](#4-instalación-de-ollama-llm)
5. [Configuración de la Aplicación](#5-configuración-de-la-aplicación)
6. [Despliegue con PM2](#6-despliegue-con-pm2)
7. [Despliegue con Docker](#7-despliegue-con-docker-alternativo)
8. [Configuración de Nginx (Reverse Proxy)](#8-configuración-de-nginx-reverse-proxy)
9. [Certificados SSL con Let's Encrypt](#9-certificados-ssl-con-lets-encrypt)
10. [Configuración de Firewall](#10-configuración-de-firewall)
11. [Monitoreo y Logs](#11-monitoreo-y-logs)
12. [Mantenimiento](#12-mantenimiento)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Requisitos del Sistema

### Hardware del Servidor

| Componente | Especificación |
|------------|----------------|
| CPU | **48 cores** |
| RAM | **192 GB** |
| Disco | 200+ GB SSD (modelos grandes) |
| Red | 1 Gbps |

> **Nota**: Con 192GB de RAM se pueden ejecutar los modelos más potentes disponibles, incluyendo **Qwen2.5:72B** (el mejor modelo open-source actualmente) con múltiples usuarios concurrentes.

### Software Requerido

- Ubuntu 22.04 LTS o 24.04 LTS
- Node.js 18.x o superior
- npm 9.x o superior
- Ollama (para StadiumGPT)
- Acceso a SQL Server (red interna)

### Conectividad

- Puerto 3000 (aplicación Next.js)
- Puerto 11434 (Ollama API - solo localhost)
- Puerto 80/443 (Nginx)
- Acceso al servidor SQL Server en puerto 1433

---

## 2. Preparación del Servidor

### 2.1 Actualizar el Sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Instalar Dependencias Base

```bash
sudo apt install -y curl wget git build-essential software-properties-common
```

### 2.3 Crear Usuario para la Aplicación (Opcional pero Recomendado)

```bash
sudo adduser --system --group --home /opt/stadium stadium
```

---

## 3. Instalación de Node.js

### 3.1 Instalar Node.js 18.x LTS

```bash
# Agregar repositorio NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js
sudo apt install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v18.x.x
npm --version   # Debe mostrar 9.x.x o superior
```

### 3.2 Configurar npm para Producción

```bash
# Configurar npm para no usar sudo globalmente
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

---

## 4. Instalación de Ollama (LLM)

Ollama es el servidor de LLM que potencia StadiumGPT. Se ejecuta completamente on-premise sin dependencias cloud.

### 4.1 Instalar Ollama

```bash
# Descargar e instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verificar instalación
ollama --version
```

### 4.2 Configurar Ollama como Servicio Systemd

El instalador generalmente crea el servicio automáticamente. Verificar:

```bash
sudo systemctl status ollama
```

Si no existe, crear el servicio **optimizado para 48 CPUs y 192GB RAM**:

```bash
sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
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

# Configuración de red
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_MODELS=/usr/share/ollama/.ollama/models"

# ============================================
# OPTIMIZACIÓN PARA 48 CPUs y 192GB RAM
# ============================================

# Número de hilos para procesamiento paralelo (usar 80% de cores)
Environment="OLLAMA_NUM_THREADS=38"

# Permitir múltiples solicitudes en paralelo
Environment="OLLAMA_NUM_PARALLEL=8"

# Mantener modelo cargado en memoria (no descargar)
Environment="OLLAMA_KEEP_ALIVE=24h"

# Máximo de modelos cargados simultáneamente
Environment="OLLAMA_MAX_LOADED_MODELS=2"

# Tamaño del contexto (más grande = más memoria, mejor calidad)
Environment="OLLAMA_NUM_CTX=8192"

# Debug (desactivar en producción)
Environment="OLLAMA_DEBUG=false"

[Install]
WantedBy=multi-user.target
EOF

# Crear usuario ollama si no existe
sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama

# Habilitar e iniciar el servicio
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama
```

### 4.3 Descargar Modelo LLM (Qwen2.5:72B - El Mejor Disponible)

Con 192GB de RAM, puedes ejecutar el modelo más potente de código abierto:

```bash
# =============================================
# MODELO PRINCIPAL: Qwen2.5:72B (RECOMENDADO)
# =============================================
# El mejor modelo open-source actualmente
# Requiere ~45GB de RAM, respuestas de altísima calidad
ollama pull qwen2.5:72b

# Tiempo de descarga: ~30-60 minutos dependiendo de la conexión
# Tamaño: ~42 GB
```

**Alternativas disponibles** (por si necesitas variedad):

| Modelo | Tamaño | RAM Requerida | Calidad | Uso |
|--------|--------|---------------|---------|-----|
| `qwen2.5:72b` | 42 GB | ~45 GB | ⭐⭐⭐⭐⭐ | **Principal - StadiumGPT** |
| `llama3.3:70b` | 40 GB | ~43 GB | ⭐⭐⭐⭐⭐ | Alternativa equivalente |
| `qwen2.5:32b` | 19 GB | ~22 GB | ⭐⭐⭐⭐ | Respuestas más rápidas |
| `deepseek-r1:70b` | 42 GB | ~45 GB | ⭐⭐⭐⭐⭐ | Excelente en razonamiento |

```bash
# Descargar alternativas (opcional)
ollama pull llama3.3:70b
ollama pull qwen2.5:32b
ollama pull deepseek-r1:70b
```

### 4.4 Verificar Instalación y Performance

```bash
# Verificar que el servicio está corriendo
sudo systemctl status ollama

# Ver modelos instalados
ollama list

# Verificar API
curl http://127.0.0.1:11434/api/tags

# Probar el modelo (primera carga tarda ~30-60 segundos)
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "qwen2.5:72b",
  "prompt": "Hola, eres StadiumGPT. Responde brevemente en español.",
  "stream": false
}'
```

### 4.5 Benchmark de Performance

Ejecutar para verificar que el modelo usa todos los recursos:

```bash
# Monitorear uso de CPU y RAM durante inferencia
htop

# En otra terminal, ejecutar consulta de prueba
time curl http://127.0.0.1:11434/api/generate -d '{
  "model": "qwen2.5:72b",
  "prompt": "Explica en 3 párrafos qué es el análisis de datos en retail.",
  "stream": false
}' | jq '.response'
```

**Tiempos esperados con 48 CPUs**:
- Primera carga del modelo: 30-60 segundos
- Respuestas subsecuentes: 5-15 segundos para respuestas medianas
- Tokens por segundo: ~15-25 tokens/s

### 4.6 Configuración Avanzada de Performance

Para ajustar aún más el rendimiento, crear archivo de configuración:

```bash
sudo tee /etc/ollama/config.json > /dev/null <<EOF
{
  "num_threads": 38,
  "num_ctx": 8192,
  "num_batch": 512,
  "num_gpu": 0,
  "main_gpu": 0,
  "low_vram": false,
  "f16_kv": true,
  "use_mmap": true,
  "use_mlock": true
}
EOF
```

**Explicación de parámetros**:
- `num_threads: 38` - Usa 38 de 48 cores (deja recursos para el sistema)
- `num_ctx: 8192` - Contexto grande para conversaciones largas
- `num_batch: 512` - Tamaño de batch para procesamiento paralelo
- `use_mmap: true` - Mapeo eficiente de memoria
- `use_mlock: true` - Bloquea modelo en RAM (evita swap)

---

## 5. Configuración de la Aplicación

### 5.1 Clonar/Copiar el Proyecto

```bash
# Opción 1: Clonar desde Git
cd /opt
sudo mkdir stadium-dashboard
sudo chown $USER:$USER stadium-dashboard
git clone <URL_DEL_REPOSITORIO> stadium-dashboard

# Opción 2: Copiar archivos manualmente
# Usar scp, rsync, o similar para copiar los archivos al servidor
```

### 5.2 Instalar Dependencias

```bash
cd /opt/stadium-dashboard
npm ci --production=false  # Incluir devDependencies para el build
```

### 5.3 Configurar Variables de Entorno

Crear archivo `.env.local`:

```bash
sudo tee /opt/stadium-dashboard/.env.local > /dev/null <<EOF
# ===========================================
# BASE DE DATOS SQL SERVER
# ===========================================
DB_USER=tu_usuario_sql
DB_PASSWORD=tu_password_sql
DB_SERVER=10.120.0.19
DB_DATABASE=anysys
DB_ENCRYPT=true

# ===========================================
# OLLAMA (StadiumGPT) - MODELO DE 72B PARÁMETROS
# ===========================================
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:72b

# ===========================================
# AUTENTICACIÓN JWT
# ===========================================
JWT_SECRET=$(openssl rand -base64 32)

# ===========================================
# CONFIGURACIÓN DE APLICACIÓN
# ===========================================
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
EOF
```

> **Importante**: Reemplazar `tu_usuario_sql` y `tu_password_sql` con las credenciales reales de SQL Server.

### 5.4 Proteger el Archivo de Configuración

```bash
chmod 600 /opt/stadium-dashboard/.env.local
```

### 5.5 Compilar la Aplicación

```bash
cd /opt/stadium-dashboard
npm run build
```

El build genera la carpeta `.next/standalone` lista para producción.

---

## 6. Despliegue con PM2

PM2 es un gestor de procesos para Node.js ideal para producción.

### 6.1 Instalar PM2

```bash
npm install -g pm2
```

### 6.2 Crear Archivo de Configuración PM2

```bash
tee /opt/stadium-dashboard/ecosystem.config.js > /dev/null <<EOF
module.exports = {
  apps: [
    {
      name: 'stadium-dashboard',
      script: '.next/standalone/server.js',
      cwd: '/opt/stadium-dashboard',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      env_file: '/opt/stadium-dashboard/.env.local',
      max_memory_restart: '1G',
      error_file: '/var/log/stadium/error.log',
      out_file: '/var/log/stadium/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
EOF
```

### 6.3 Crear Directorio de Logs

```bash
sudo mkdir -p /var/log/stadium
sudo chown $USER:$USER /var/log/stadium
```

### 6.4 Copiar Archivos Estáticos al Standalone

```bash
cp -r /opt/stadium-dashboard/public /opt/stadium-dashboard/.next/standalone/
cp -r /opt/stadium-dashboard/.next/static /opt/stadium-dashboard/.next/standalone/.next/
```

### 6.5 Iniciar la Aplicación

```bash
cd /opt/stadium-dashboard
pm2 start ecosystem.config.js
```

### 6.6 Configurar PM2 para Inicio Automático

```bash
pm2 startup systemd
# Ejecutar el comando que PM2 indica

pm2 save
```

### 6.7 Comandos Útiles de PM2

```bash
# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs stadium-dashboard

# Reiniciar aplicación
pm2 restart stadium-dashboard

# Recargar sin downtime
pm2 reload stadium-dashboard

# Detener aplicación
pm2 stop stadium-dashboard

# Monitoreo en tiempo real
pm2 monit
```

---

## 7. Despliegue con Docker (Alternativo)

### 7.1 Instalar Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install -y docker-compose-plugin

# Verificar instalación
docker --version
docker compose version
```

### 7.2 Archivo docker-compose.yml para Producción

```bash
tee /opt/stadium-dashboard/docker-compose.prod.yml > /dev/null <<EOF
version: '3.8'

services:
  stadium-dashboard:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: stadium-dashboard
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_SERVER=10.120.0.19
      - DB_USER=\${DB_USER}
      - DB_PASSWORD=\${DB_PASSWORD}
      - DB_DATABASE=anysys
      - DB_ENCRYPT=true
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - OLLAMA_MODEL=qwen2.5:72b
      - JWT_SECRET=\${JWT_SECRET}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Ollama en Docker (opcional, si no se instala en el host)
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: always
    # Para GPU NVIDIA (opcional):
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]

volumes:
  ollama_data:
EOF
```

### 7.3 Crear Archivo .env para Docker

```bash
tee /opt/stadium-dashboard/.env > /dev/null <<EOF
DB_USER=tu_usuario_sql
DB_PASSWORD=tu_password_sql
JWT_SECRET=$(openssl rand -base64 32)
EOF

chmod 600 /opt/stadium-dashboard/.env
```

### 7.4 Construir y Ejecutar

```bash
cd /opt/stadium-dashboard

# Construir imagen
docker compose -f docker-compose.prod.yml build

# Iniciar servicios
docker compose -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f
```

### 7.5 Descargar Modelo en Ollama Docker

Si usas Ollama en Docker:

```bash
docker exec -it ollama ollama pull qwen2.5:72b
```

---

## 8. Configuración de Nginx (Reverse Proxy)

### 8.1 Instalar Nginx

```bash
sudo apt install -y nginx
```

### 8.2 Configurar Virtual Host

```bash
sudo tee /etc/nginx/sites-available/stadium-dashboard > /dev/null <<EOF
upstream stadium_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Redirigir HTTP a HTTPS (descomentar cuando tengas SSL)
    # return 301 https://\$server_name\$request_uri;

    location / {
        proxy_pass http://stadium_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Archivos estáticos con caché largo
    location /_next/static {
        proxy_pass http://stadium_backend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://stadium_backend;
        access_log off;
    }

    # Límites de tamaño para uploads
    client_max_body_size 10M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
}
EOF
```

### 8.3 Habilitar el Sitio

```bash
sudo ln -sf /etc/nginx/sites-available/stadium-dashboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 9. Certificados SSL con Let's Encrypt

### 9.1 Instalar Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 9.2 Obtener Certificado

```bash
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

### 9.3 Renovación Automática

Certbot configura automáticamente un timer para renovación. Verificar:

```bash
sudo systemctl status certbot.timer
```

---

## 10. Configuración de Firewall

### 10.1 Configurar UFW

```bash
# Habilitar UFW
sudo ufw enable

# Permitir SSH
sudo ufw allow ssh

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# NO exponer el puerto 3000 directamente (usar Nginx)
# NO exponer el puerto 11434 (Ollama solo local)

# Verificar reglas
sudo ufw status verbose
```

---

## 11. Monitoreo y Logs

### 11.1 Logs de la Aplicación

```bash
# Con PM2
pm2 logs stadium-dashboard

# Con Docker
docker compose logs -f stadium-dashboard

# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 11.2 Logs de Ollama

```bash
sudo journalctl -u ollama -f
```

### 11.3 Monitoreo de Recursos

```bash
# Instalar htop
sudo apt install -y htop

# Ver uso de recursos
htop

# Con PM2
pm2 monit
```

### 11.4 Health Check Endpoint

Crear un endpoint de health check si no existe:

```bash
# La aplicación debería responder en:
curl http://localhost:3000/api/health
```

---

## 12. Mantenimiento

### 12.1 Actualizar la Aplicación

```bash
cd /opt/stadium-dashboard

# Detener aplicación
pm2 stop stadium-dashboard

# Actualizar código
git pull origin main

# Instalar dependencias
npm ci

# Reconstruir
npm run build

# Copiar estáticos
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Reiniciar
pm2 restart stadium-dashboard
```

### 12.2 Actualizar Modelos de Ollama

```bash
# Actualizar modelo existente
ollama pull qwen2.5:72b

# Ver modelos instalados
ollama list

# Eliminar modelo antiguo
ollama rm nombre-modelo-antiguo
```

### 12.3 Backups

```bash
# Backup de configuración
sudo cp /opt/stadium-dashboard/.env.local /backup/env.local.$(date +%Y%m%d)

# Backup de modelos Ollama (opcional, son grandes)
sudo tar -czvf /backup/ollama-models-$(date +%Y%m%d).tar.gz /usr/share/ollama/.ollama/models
```

### 12.4 Rotación de Logs

```bash
sudo tee /etc/logrotate.d/stadium-dashboard > /dev/null <<EOF
/var/log/stadium/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

---

## 13. Troubleshooting

### Problema: La aplicación no inicia

```bash
# Verificar logs
pm2 logs stadium-dashboard --lines 100

# Verificar que el build existe
ls -la /opt/stadium-dashboard/.next/standalone/

# Verificar variables de entorno
cat /opt/stadium-dashboard/.env.local
```

### Problema: No conecta a SQL Server

```bash
# Verificar conectividad
telnet 10.120.0.19 1433

# Verificar credenciales en .env.local
grep DB_ /opt/stadium-dashboard/.env.local

# Probar conexión con sqlcmd (si está instalado)
sqlcmd -S 10.120.0.19 -U tu_usuario -P tu_password -Q "SELECT 1"
```

### Problema: StadiumGPT no responde

```bash
# Verificar que Ollama está corriendo
sudo systemctl status ollama

# Verificar que el modelo está descargado
ollama list

# Probar Ollama directamente
curl http://127.0.0.1:11434/api/tags

# Ver logs de Ollama
sudo journalctl -u ollama --since "5 minutes ago"
```

### Problema: Modelo lento o no responde

Con 192GB de RAM y 48 CPUs, el modelo `qwen2.5:72b` debería funcionar perfectamente. Si hay lentitud:

```bash
# Verificar uso de recursos durante inferencia
htop

# Ver si el modelo está cargado en memoria
curl http://127.0.0.1:11434/api/ps

# Si el modelo no está cargado, forzar carga previa
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "qwen2.5:72b",
  "prompt": "test",
  "stream": false
}'

# Verificar configuración de threads
cat /etc/systemd/system/ollama.service | grep THREADS

# Si hay muchas solicitudes simultáneas, verificar NUM_PARALLEL
cat /etc/systemd/system/ollama.service | grep PARALLEL
```

**Optimización adicional**: Si el modelo se descarga frecuentemente:

```bash
# Editar servicio para mantener modelo cargado permanentemente
sudo systemctl edit ollama

# Agregar:
[Service]
Environment="OLLAMA_KEEP_ALIVE=-1"

# Reiniciar
sudo systemctl restart ollama
```

### Problema: Nginx devuelve 502 Bad Gateway

```bash
# Verificar que la app está corriendo
pm2 status

# Verificar que escucha en el puerto
ss -tlnp | grep 3000

# Verificar logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Resumen de Recursos del Servidor

### Uso Esperado de Recursos

| Componente | CPU | RAM | Disco |
|------------|-----|-----|-------|
| **Qwen2.5:72B** (modelo LLM) | 38 cores | ~50 GB | 42 GB |
| **Stadium Dashboard** (Next.js) | 2-4 cores | ~1 GB | 500 MB |
| **Nginx** | 1 core | ~100 MB | 50 MB |
| **Sistema Operativo** | 2-4 cores | ~2 GB | 10 GB |
| **Disponible para otros servicios** | ~4 cores | ~138 GB | - |

### Capacidad de Usuarios Concurrentes

Con la configuración `OLLAMA_NUM_PARALLEL=8`:
- **8 consultas simultáneas** a StadiumGPT sin degradación
- **Tiempo de respuesta**: 5-15 segundos por consulta
- **Tokens por segundo**: ~15-25 tokens/s

---

## Resumen de Puertos

| Servicio | Puerto | Acceso |
|----------|--------|--------|
| Stadium Dashboard | 3000 | Solo localhost (via Nginx) |
| Ollama API | 11434 | Solo localhost |
| Nginx HTTP | 80 | Público |
| Nginx HTTPS | 443 | Público |
| SQL Server | 1433 | Red interna |

---

## Checklist de Despliegue

- [ ] Ubuntu actualizado
- [ ] Node.js 18.x instalado
- [ ] Ollama instalado y corriendo
- [ ] Modelo LLM descargado (`qwen2.5:72b` o alternativa)
- [ ] Código de la aplicación copiado
- [ ] Dependencias npm instaladas
- [ ] Archivo `.env.local` configurado
- [ ] Aplicación compilada (`npm run build`)
- [ ] PM2 configurado e iniciando al boot
- [ ] Nginx configurado como reverse proxy
- [ ] Certificado SSL instalado (si aplica)
- [ ] Firewall configurado
- [ ] Conectividad a SQL Server verificada
- [ ] Health checks funcionando

---

## Contacto y Soporte

Para problemas específicos de la aplicación, revisar los logs:

```bash
# Logs de aplicación
pm2 logs stadium-dashboard

# Logs de Ollama
sudo journalctl -u ollama -f

# Logs de Nginx
sudo tail -f /var/log/nginx/error.log
```
