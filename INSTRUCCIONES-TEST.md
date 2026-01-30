# Instrucciones para Test Completo del Proyecto

## Objetivo
Validar que el proyecto Stadium Dashboard funciona correctamente antes de hacer push a producción.

## Pre-requisitos
- Estar en el directorio del proyecto: `/home/aisrvadmin/stadium-dashboard`
- Tener acceso a la base de datos SQL Server
- Tener el archivo `.env.local` configurado

---

## 1. Verificar que el proyecto compila

```bash
npm run build
```

**Esperado:** Build exitoso sin errores.

---

## 2. Levantar el servidor en modo desarrollo

```bash
npm run dev
```

**Esperado:** Servidor corriendo en http://localhost:3000

---

## 3. Test de APIs (ejecutar en otra terminal)

### 3.1 Health Check - Auth endpoint
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me
```
**Esperado:** `401` (no autenticado, pero responde)

### 3.2 Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"TU_PASSWORD"}' \
  -c cookies.txt -b cookies.txt -v
```
**Esperado:** `200` con JSON de usuario

### 3.3 Auth Check (con cookie)
```bash
curl -s http://localhost:3000/api/auth/me -b cookies.txt
```
**Esperado:** `200` con datos del usuario autenticado

### 3.4 Dashboard Data
```bash
curl -s http://localhost:3000/api/dashboard -b cookies.txt | head -c 500
```
**Esperado:** JSON con datos del dashboard

### 3.5 Productos
```bash
curl -s "http://localhost:3000/api/products?page=1&limit=10" -b cookies.txt | head -c 500
```
**Esperado:** JSON con lista de productos

### 3.6 Sell-Out
```bash
curl -s http://localhost:3000/api/sell-out -b cookies.txt | head -c 500
```
**Esperado:** JSON con datos de sell-out

### 3.7 Price Actions - Watchlist Config
```bash
curl -s http://localhost:3000/api/price-actions/watchlist/config -b cookies.txt
```
**Esperado:** JSON con configuración de watchlist

---

## 4. Test de UI con Playwright

### 4.1 Instalar browsers de Playwright (si no están)
```bash
npx playwright install chromium
```

### 4.2 Ejecutar tests E2E
```bash
npm run test:e2e -- --project=chromium
```

**Esperado:** Tests pasando (algunos pueden skippearse si requieren datos específicos)

### 4.3 Ejecutar en modo visual (para ver el browser)
```bash
npm run test:e2e:headed
```

---

## 5. Navegación Manual de UI

Abrir en browser http://localhost:3000 y verificar:

### 5.1 Login
- [ ] Página de login carga correctamente
- [ ] Formulario de usuario/password visible
- [ ] Login exitoso redirige al dashboard

### 5.2 Dashboard Principal
- [ ] KPIs principales cargan (Venta, Unidades, Margen, etc.)
- [ ] Gráfico comparativo muestra datos
- [ ] Filtros funcionan (fechas, categorías)
- [ ] Switch año anterior funciona

### 5.3 Tabla de Productos
- [ ] Tabla carga con datos
- [ ] Paginación funciona
- [ ] Ordenamiento por columnas funciona
- [ ] Click en producto abre detalle

### 5.4 Detalle de Producto
- [ ] Modal/página de detalle abre
- [ ] Métricas del producto visibles
- [ ] Tabla de tallas muestra datos
- [ ] Gráfico de tendencia visible

### 5.5 Price Actions
- [ ] Menú navega a Price Actions
- [ ] Configuración de watchlist visible
- [ ] Si hay datos, tabla de watchlist carga

### 5.6 Recompra
- [ ] Página de recompra carga
- [ ] Filtros funcionan
- [ ] Datos se muestran correctamente

### 5.7 Sell-Out
- [ ] Página de sell-out carga
- [ ] Clasificación de productos visible
- [ ] Filtros funcionan

### 5.8 StadiumGPT (si Ollama está corriendo)
- [ ] Chat abre correctamente
- [ ] Puede enviar mensaje
- [ ] Recibe respuesta del modelo

---

## 6. Comparar con Producción

Abrir en paralelo:
- **Local:** http://localhost:3000
- **Prod:** http://179.27.76.130

Verificar que:
- [ ] Mismos KPIs principales
- [ ] Mismos productos en tabla
- [ ] Misma estructura de menú
- [ ] Estilos y colores iguales

---

## 7. Validación Final

Si todo lo anterior pasa:

```bash
# Detener servidor dev
# Ctrl+C

# Limpiar cookies de test
rm -f cookies.txt

# El proyecto está listo para push
echo "✅ Proyecto validado - listo para push"
```

---

## Problemas Comunes

### Build falla
```bash
# Limpiar cache de Next.js
rm -rf .next
npm run build
```

### API no responde
```bash
# Verificar .env.local tiene las variables correctas
cat .env.local

# Verificar conexión a BD
# (las credenciales deben ser correctas)
```

### Playwright no encuentra browsers
```bash
npx playwright install
```

### Tests E2E fallan por timeout
```bash
# Aumentar timeout o ejecutar individualmente
npm run test:e2e -- --timeout=60000
npm run test:e2e -- auth.spec.ts
```
