# Configuración de GitHub - Stadium Dashboard

## 1. Push Inicial al Repositorio

El commit ya está creado. Solo necesitas hacer push con autenticación.

### Opción A: Usando GitHub CLI (Recomendado)

```bash
# Instalar GitHub CLI si no lo tienes
# macOS: brew install gh
# Windows: winget install GitHub.cli

# Autenticarse
gh auth login

# Push
cd /ruta/a/stadium-dashboard
git push -u origin main
```

### Opción B: Usando Token Personal

1. Ir a **GitHub > Settings > Developer settings > Personal access tokens > Generate new token**
2. Seleccionar permisos: `repo` (full control)
3. Copiar el token

```bash
# Configurar credenciales
git config credential.helper store

# Push (usar token como password)
git push -u origin main
# Username: tu-usuario-github
# Password: <pegar-token>
```

### Opción C: Usando SSH

```bash
# Generar clave SSH si no tienes
ssh-keygen -t ed25519 -C "tu-email@ejemplo.com"

# Agregar a GitHub: Settings > SSH and GPG keys > New SSH key
cat ~/.ssh/id_ed25519.pub

# Cambiar remote a SSH
git remote set-url origin git@github.com:GmonzonJP/stadium-dashboard.git

# Push
git push -u origin main
```

---

## 2. Configurar Secrets para CI/CD

Una vez que el código esté en GitHub, configura los secrets:

### En GitHub: Settings > Secrets and variables > Actions

| Secret | Valor | Descripción |
|--------|-------|-------------|
| `SSH_USER` | `deploy` (o tu usuario) | Usuario SSH del servidor |
| `SSH_PRIVATE_KEY` | Contenido de tu clave privada | Para conectar al servidor |
| `JWT_SECRET` | `openssl rand -base64 32` | Secret para JWT |

### Generar clave SSH para GitHub Actions

```bash
# En tu máquina local
ssh-keygen -t ed25519 -C "github-actions@stadium-dashboard" -f ~/.ssh/github-actions-deploy

# Agregar clave pública al servidor
ssh-copy-id -i ~/.ssh/github-actions-deploy.pub -p 2224 deploy@179.27.76.130

# El contenido de esta clave privada va en SSH_PRIVATE_KEY
cat ~/.ssh/github-actions-deploy
```

---

## 3. Verificar CI/CD

Una vez configurados los secrets:

1. Ir a **Actions** en GitHub
2. El workflow de CI debería ejecutarse automáticamente
3. Para probar el deploy, crear un tag:

```bash
git tag v2.1.0
git push origin v2.1.0
```

---

## 4. Crear Environment de Producción (Opcional)

Para aprobación manual antes de deploy:

1. **Settings > Environments > New environment**
2. Nombre: `production`
3. Activar **Required reviewers**
4. Agregar usuarios que pueden aprobar

---

## Estructura Final del Proyecto

```
stadium-dashboard/
├── .github/workflows/        # CI/CD pipelines
│   ├── ci.yml               # Tests en cada push/PR
│   ├── deploy.yml           # Deploy a producción
│   └── release.yml          # Crear releases
├── docs/                     # Documentación técnica
│   ├── architecture/        # Arquitectura del sistema
│   ├── api/                 # Referencia de API
│   ├── decisions/           # ADRs
│   ├── infrastructure/      # Infra y CI/CD
│   ├── testing/             # Guía de testing
│   ├── legacy/              # Docs antiguos
│   └── resources/           # PDFs, screenshots
├── e2e/                      # Tests E2E (Playwright)
├── src/
│   ├── __tests__/           # Unit tests (Jest)
│   └── ...                  # Código fuente
├── .env.example             # Template de variables
├── jest.config.js           # Config Jest
├── playwright.config.ts     # Config Playwright
└── ...
```

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Tests
npm run test              # Unit tests
npm run test:coverage     # Con coverage
npm run test:e2e          # E2E tests
npm run test:e2e:ui       # E2E con UI

# Build
npm run build

# Crear release
npm version patch         # 2.1.0 -> 2.1.1
npm version minor         # 2.1.0 -> 2.2.0
npm version major         # 2.1.0 -> 3.0.0
git push origin main --tags
```
