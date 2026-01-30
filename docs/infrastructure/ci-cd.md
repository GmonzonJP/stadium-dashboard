# CI/CD Pipeline - Stadium Dashboard

## Visión General

El proyecto utiliza GitHub Actions para automatizar testing, building y deployment.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CI/CD PIPELINE                                   │
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │   Push   │───▶│   Lint   │───▶│  Tests   │───▶│  Build   │          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘          │
│                                                        │                 │
│                                                        ▼                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ Running  │◀───│ Restart  │◀───│  Deploy  │◀───│  Backup  │          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘          │
│       │                                                                  │
│       ▼                                                                  │
│  ┌──────────┐    ┌──────────┐                                           │
│  │ Health   │───▶│ Success  │                                           │
│  │  Check   │    │   or     │                                           │
│  └──────────┘    │ Rollback │                                           │
│                  └──────────┘                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. CI (ci.yml)

**Trigger:** Push o PR a `main` o `develop`

| Job | Descripción | Tiempo ~
|-----|-------------|---------|
| Lint | ESLint + TypeScript check | 1-2 min |
| Unit Tests | Jest tests con coverage | 2-3 min |
| E2E Tests | Playwright (Chromium) | 5-10 min |
| Build | Next.js production build | 3-4 min |
| Security | npm audit | 1 min |

### 2. Deploy (deploy.yml)

**Trigger:** Push a `main` o tags `v*`

**Proceso:**
1. Build de producción
2. Empaquetado (`.next`, `public`, `package.json`)
3. Backup del deployment actual
4. Upload vía SCP
5. Install dependencies en servidor
6. PM2 reload
7. Health check

### 3. Release (release.yml)

**Trigger:** Push de tag `v*`

Genera release en GitHub con changelog automático.

## Configuración de Secrets

### Secrets Requeridos en GitHub

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `SSH_USER` | Usuario SSH del servidor | `deploy` |
| `SSH_PRIVATE_KEY` | Clave privada SSH | `-----BEGIN...` |
| `JWT_SECRET` | Secret para JWT | `openssl rand -base64 32` |

### Configurar Secrets

1. Ir a **Settings > Secrets and variables > Actions**
2. Click **New repository secret**
3. Agregar cada secret

### Generar SSH Key

```bash
# En tu máquina local
ssh-keygen -t ed25519 -C "github-actions@stadium-dashboard"

# Copiar clave pública al servidor
ssh-copy-id -p 2224 deploy@179.27.76.130

# El contenido de la clave privada va en SSH_PRIVATE_KEY
cat ~/.ssh/id_ed25519
```

## Rollback

### Manual via GitHub Actions

1. Ir a **Actions > Deploy to Production**
2. Click **Run workflow**
3. En `rollback_to` ingresar versión (ej: `v2.0.0`)
4. Click **Run workflow**

### Manual via SSH

```bash
ssh -p 2224 deploy@179.27.76.130

cd /home/deploy/stadium-dashboard

# Ver backups disponibles
ls -la backups/

# Ejecutar rollback
tar -xzf backups/backup-v2.0.0-20260128-123456.tar.gz
npm ci --production
pm2 reload stadium-dashboard
```

### Auto-rollback

Si el deployment falla el health check:
1. Se dispara job `cleanup-on-failure`
2. Restaura automáticamente el último backup
3. Reinicia la aplicación

## Health Checks

El pipeline verifica que la aplicación está funcionando:

```bash
# El endpoint /api/auth/me devuelve:
# - 200 si hay sesión válida
# - 401 si no hay sesión (también válido, indica que la app responde)

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me
```

## Estructura de Backups

```
/home/deploy/stadium-dashboard/
├── backups/
│   ├── backup-v2.0.0-20260128-123456.tar.gz
│   ├── backup-v2.0.1-20260129-094532.tar.gz
│   └── pre-rollback-20260130-143021.tar.gz  # Creado antes de rollback
├── VERSION          # Archivo con info de versión actual
└── ...
```

**Contenido de VERSION:**
```
v2.1.0
abc123def456789
2026-01-30T14:30:00Z
```

## Crear Nueva Release

### Semántica de Versiones

```
v{MAJOR}.{MINOR}.{PATCH}

MAJOR: Cambios incompatibles con versión anterior
MINOR: Nueva funcionalidad compatible
PATCH: Bug fixes
```

### Proceso

```bash
# 1. Actualizar version en package.json
npm version patch  # o minor, major

# 2. Crear tag
git tag v2.1.0

# 3. Push con tags
git push origin main --tags
```

## Monitorear Deployments

### Logs en GitHub

**Actions > Deploy to Production > [Run específico]**

### Logs en Servidor

```bash
# Logs de PM2
pm2 logs stadium-dashboard

# Logs de la aplicación
pm2 logs stadium-dashboard --lines 100

# Monitoreo en vivo
pm2 monit
```

### Status del Deployment

```bash
# Ver info del deployment actual
cat /home/deploy/stadium-dashboard/VERSION

# Status de PM2
pm2 show stadium-dashboard
```

## Troubleshooting

### Build Falla

```yaml
# Verificar logs del job "Build"
# Común: Variables de entorno faltantes

# Solución: Agregar secret JWT_SECRET en GitHub
```

### Deploy Falla (SSH)

```bash
# Verificar conectividad
ssh -p 2224 deploy@179.27.76.130 "echo 'SSH OK'"

# Verificar permisos
ls -la ~/.ssh/id_rsa  # Debe ser 600
```

### Health Check Falla

```bash
# Verificar que la app inicia correctamente
pm2 logs stadium-dashboard --lines 50

# Verificar puerto
ss -tlnp | grep 3000

# Test manual
curl -v http://localhost:3000/api/auth/me
```

### Disco Lleno (Backups)

```bash
# Ver espacio
df -h

# Limpiar backups antiguos manualmente
ls -la backups/
rm backups/backup-old-version.tar.gz
```

## Environments

GitHub Actions usa **Environments** para control adicional:

| Environment | Uso | Protecciones |
|-------------|-----|--------------|
| `production` | Deploy a prod | Required reviewers (opcional) |

### Configurar Protecciones (Opcional)

1. **Settings > Environments > production**
2. Activar **Required reviewers**
3. Agregar usuarios aprobadores

Esto requiere aprobación manual antes de cada deploy a producción.
