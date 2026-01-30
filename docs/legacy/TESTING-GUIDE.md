# Stadium Dashboard - Guía de Testing End-to-End

## Acceso al Sistema

| URL | Credenciales |
|-----|--------------|
| **Producción** | http://179.27.76.130/ |
| **Local Dev** | http://localhost:3000/ |
| **Usuario Admin** | admin / admin123 |

---

## Checklist de Testing Completo

### Pre-requisitos
- [ ] Servidor accesible (ping 179.27.76.130)
- [ ] PM2 status online (`pm2 status` en servidor)
- [ ] Ollama running (`curl http://127.0.0.1:11434/api/tags` en servidor)
- [ ] Base de datos accesible

---

## 1. LOGIN Y AUTENTICACIÓN

### 1.1 Acceso al Login
- [ ] Abrir http://179.27.76.130/
- [ ] Verificar redirección automática a `/login`
- [ ] Verificar que el formulario se muestra correctamente

### 1.2 Login Exitoso
- [ ] Ingresar usuario: `admin`
- [ ] Ingresar contraseña: `admin123`
- [ ] Click en "Iniciar Sesión"
- [ ] **Esperado**: Redirección al dashboard principal

### 1.3 Login Fallido
- [ ] Intentar con credenciales incorrectas
- [ ] **Esperado**: Mensaje de error "Usuario o contraseña incorrectos"

### 1.4 Sesión Persistente
- [ ] Cerrar pestaña y volver a abrir
- [ ] **Esperado**: Sesión mantenida (si marcó "Recordarme")

### 1.5 Logout
- [ ] Click en menú de usuario (esquina superior derecha)
- [ ] Click en "Cerrar sesión"
- [ ] **Esperado**: Redirección a login

---

## 2. DASHBOARD PRINCIPAL

### 2.1 Carga Inicial
- [ ] Verificar que el dashboard carga sin errores
- [ ] Verificar spinner de carga mientras obtiene datos
- [ ] Verificar que todas las métricas se muestran

### 2.2 Tarjetas de Métricas (MetricCards)
| Tarjeta | Verificar |
|---------|-----------|
| **Unidades Vendidas** | [ ] Muestra número > 0 |
| **Ventas ($)** | [ ] Formato con $ y separador de miles |
| **Costo ($)** | [ ] Formato con $ y separador de miles |
| **Margen (%)** | [ ] Porcentaje entre 0-100% |
| **Markup (%)** | [ ] Porcentaje positivo |
| **Stock Estimado** | [ ] Número entero |

### 2.3 Click en Tarjetas (NUEVO)
- [ ] Click en tarjeta "Unidades Vendidas"
- [ ] **Esperado**:
  - Scroll automático hacia abajo
  - Tabla comparativa aparece debajo de las tarjetas
  - Datos agrupados por marca/tienda
  - Columna "Anterior" muestra datos del año pasado
  - Valores en **verde** si actual > anterior
  - Valores en **rojo** si actual < anterior

### 2.4 Switch Comparativo (52s/Calendario)
- [ ] Verificar switch en la parte superior
- [ ] Cambiar de "Calendario" a "52 semanas"
- [ ] **Esperado**: Métricas se recalculan

### 2.5 Gráfico Comparativo
- [ ] Verificar que el gráfico de barras se muestra
- [ ] Verificar leyenda (Actual vs Anterior)
- [ ] Hover sobre barras muestra tooltip

---

## 3. FILTROS

### 3.1 Panel de Filtros
- [ ] Click en botón "Filtros" (icono embudo)
- [ ] Verificar que panel desplegable se abre

### 3.2 Filtro por Tienda
- [ ] Expandir selector de tiendas
- [ ] Seleccionar una tienda específica (ej: STADIUM001)
- [ ] Aplicar filtro
- [ ] **Esperado**: Datos se filtran solo para esa tienda

### 3.3 Filtro por Marca
- [ ] Expandir selector de marcas
- [ ] Seleccionar una marca (ej: Adidas)
- [ ] Aplicar filtro
- [ ] **Esperado**: Solo productos de esa marca

### 3.4 Filtro por Género
- [ ] Seleccionar género (Hombre/Mujer/Unisex)
- [ ] **Esperado**: Productos filtrados por género

### 3.5 Filtro por Categoría
- [ ] Seleccionar categoría (Zapatilla, Sandalia, etc.)
- [ ] **Esperado**: Productos filtrados por categoría

### 3.6 Combinación de Filtros
- [ ] Aplicar múltiples filtros simultáneamente
- [ ] **Esperado**: Intersección correcta de filtros

### 3.7 Limpiar Filtros
- [ ] Click en "Limpiar filtros"
- [ ] **Esperado**: Todos los filtros removidos

### 3.8 Tags de Filtros Activos
- [ ] Verificar que aparecen tags debajo de filtros
- [ ] Click en X del tag para remover filtro individual

---

## 4. SELECTOR DE FECHAS

### 4.1 Presets de Fecha
| Preset | Verificar |
|--------|-----------|
| **Hoy** | [ ] Solo fecha de hoy |
| **Ayer** | [ ] Día anterior |
| **Esta Semana** | [ ] Lunes a hoy |
| **Este Mes** | [ ] **Día 1 del mes** hasta hoy (NUEVO) |
| **Últimos 7 días** | [ ] 7 días hacia atrás |
| **Últimos 30 días** | [ ] 30 días hacia atrás |

### 4.2 Selector Manual
- [ ] Click en fecha de inicio
- [ ] Seleccionar fecha en calendario
- [ ] Click en fecha de fin
- [ ] Seleccionar fecha en calendario
- [ ] **Esperado**: Rango aplicado correctamente

---

## 5. TABLA DE ANÁLISIS DE PRODUCTOS

### 5.1 Carga de Tabla
- [ ] Scroll hacia abajo para ver la tabla
- [ ] Verificar que productos se listan

### 5.2 Columnas de la Tabla
| Columna | Verificar |
|---------|-----------|
| **Imagen** | [ ] Thumbnail del producto |
| **BaseCol** | [ ] Código de producto |
| **Marca** | [ ] Nombre de marca |
| **Descripción** | [ ] Descripción del producto |
| **Unidades** | [ ] Número vendido |
| **Venta** | [ ] Monto en $ |
| **ASP** | [ ] Precio promedio |
| **Stock** | [ ] Cantidad disponible |
| **Días Stock** | [ ] Estimación días para vender |
| **Semáforo** | [ ] Indicador verde/amarillo/rojo (NUEVO) |

### 5.3 Badges de Estado (NUEVO)
- [ ] Verificar badge **🚀 Fast** (verde) - Productos que venden rápido
- [ ] Verificar badge **✓ OK** (azul) - Ritmo normal
- [ ] Verificar badge **🐢 Slow** (amarillo) - Vendiendo lento
- [ ] Verificar badge **🔥 Burn** (rojo) - Clavos, hay que liquidar

### 5.4 Ordenamiento
- [ ] Click en header de columna "Venta"
- [ ] **Esperado**: Ordenar descendente/ascendente

### 5.5 Búsqueda
- [ ] Ingresar texto en campo de búsqueda
- [ ] **Esperado**: Filtrado por marca/descripción

### 5.6 Paginación
- [ ] Navegar entre páginas
- [ ] Cambiar cantidad de items por página

---

## 6. FICHA DE PRODUCTO (NUEVO - Estilo CYBE)

### 6.1 Acceso
- [ ] Click en fila de producto en la tabla
- [ ] **Esperado**: Modal/página de detalle se abre

### 6.2 Header del Producto
- [ ] Verificar código BaseCol
- [ ] Verificar marca
- [ ] Verificar descripción completa
- [ ] Verificar imagen principal grande

### 6.3 Miniaturas de Colores (NUEVO)
- [ ] Verificar thumbnails de otros colores debajo de imagen
- [ ] Click en otro color
- [ ] **Esperado**: Ficha cambia al color seleccionado

### 6.4 Grid de Métricas (NUEVO)
| Métrica | Verificar |
|---------|-----------|
| **Ritmo de Venta** | [ ] Pares/día |
| **Días Stock** | [ ] Estimación |
| **Stock Total** | [ ] Cantidad |
| **Margen Bruto** | [ ] Porcentaje |
| **Costo** | [ ] Último costo |
| **PVP** | [ ] Precio de venta |
| **Últ. Compra** | [ ] Fecha |
| **1ra Venta** | [ ] Fecha |
| **Últ. Venta** | [ ] Fecha |
| **Un. Vendidas Hist.** | [ ] Total histórico |

### 6.5 Tabla Unificada Stock + Ventas (NUEVO)
- [ ] Verificar header sticky (no se mueve al scroll)
- [ ] Verificar tallas en columnas (33, 34, 35, etc.)
- [ ] Verificar sección **STOCK POR TALLA**:
  - [ ] Fila de DEPOSITO_CENTRAL con stock
  - [ ] Filas de tiendas con stock
  - [ ] **Celdas en ROJO** cuando stock=0 en tienda pero hay stock en central
  - [ ] Celdas vacías cuando stock=0 (no mostrar "0")
- [ ] Verificar sección **VENTAS POR TALLA**:
  - [ ] Ventas por tienda
  - [ ] Totales correctos
- [ ] Verificar footer sticky con totales

### 6.6 Selector de Período Inline
- [ ] Verificar DatePicker inline en la ficha
- [ ] Cambiar rango de fechas
- [ ] **Esperado**: Datos de ventas se actualizan

### 6.7 Top 7 Tiendas por Ventas
- [ ] Verificar ranking de tiendas
- [ ] Verificar orden descendente por ventas

---

## 7. PÁGINA SELL-OUT (NUEVO)

### 7.1 Acceso
- [ ] Click en "Sell Out" en el sidebar
- [ ] **Esperado**: Página de análisis sell-out carga

### 7.2 Vista por Marca
- [ ] Verificar tabla con marcas
- [ ] Columnas: Marca, Un. Vendidas, Venta Total, Stock
- [ ] Columnas: Fast Movers, OK, Slow Movers, Clavos
- [ ] Porcentaje Slow Movers

### 7.3 Vista por Producto
- [ ] Cambiar a vista por producto
- [ ] Verificar badges de estado (Fast/OK/Slow/Burn)
- [ ] Verificar días de stock estimados

### 7.4 Resumen
- [ ] Verificar tarjetas de resumen:
  - [ ] Total Productos
  - [ ] Fast Movers
  - [ ] OK
  - [ ] Slow Movers
  - [ ] Clavos
  - [ ] Valor Inventario Slow Movers
  - [ ] Valor Inventario Clavos

---

## 8. INCIDENCIAS / ALERTAS (NUEVO)

### 8.1 Panel de Incidencias
- [ ] Verificar que aparecen alertas en el dashboard
- [ ] O acceder a sección de Incidencias

### 8.2 Alerta de Reabastecimiento
- [ ] Verificar tarjeta de alerta con:
  - [ ] Título: "Reabastecimiento: [Marca] en [Tienda]"
  - [ ] Mensaje con detalles del problema
  - [ ] Badge de severidad (crítica/alta/media)
  - [ ] Stock en Central
  - [ ] Días sin venta en tienda
  - [ ] Cantidad sugerida a enviar

### 8.3 Acciones
- [ ] Click en "Aprobar"
- [ ] **Esperado**: Acción registrada
- [ ] Click en "Ignorar"
- [ ] **Esperado**: Solicita motivo antes de ignorar
- [ ] Click en "Modificar cantidad"
- [ ] **Esperado**: Permite editar cantidad sugerida

### 8.4 Alertas de Clavos
- [ ] Verificar alertas de productos >365 días para vender
- [ ] Verificar sugerencia de descuento
- [ ] Verificar valor del inventario afectado

---

## 9. RECOMPRA

### 9.1 Acceso
- [ ] Click en "Recompra" en sidebar
- [ ] **Esperado**: Página de recompra carga

### 9.2 Lista de Productos
- [ ] Verificar productos listados
- [ ] Verificar semáforo de reposición

### 9.3 Detalles de Recompra
- [ ] Click en producto
- [ ] Verificar cálculo de reposición sugerida

---

## 10. PRICE ACTIONS

### 10.1 Acceso
- [ ] Click en "Price Actions" en sidebar

### 10.2 Watchlist
- [ ] Verificar tabla de productos en watchlist
- [ ] Verificar Score de cada producto
- [ ] Verificar métricas de elasticidad

### 10.3 Simulador de Precios
- [ ] Seleccionar producto
- [ ] Mover slider de descuento
- [ ] **Esperado**: Gráfico muestra proyección de ventas

### 10.4 Cola de Propuestas
- [ ] Verificar propuestas pendientes
- [ ] Aprobar/Rechazar propuesta

---

## 11. STADIUMGPT (Chat IA)

### 11.1 Acceso
- [ ] Click en "StadiumGPT" en sidebar
- [ ] O click en icono de chat

### 11.2 Enviar Consulta
- [ ] Escribir pregunta: "¿Cuáles son las 5 marcas más vendidas?"
- [ ] Click en enviar
- [ ] **Esperado**: Respuesta del modelo LLM

### 11.3 Contexto de Datos
- [ ] Preguntar sobre datos específicos
- [ ] **Esperado**: Respuesta basada en datos reales de la base

### 11.4 Timeout
- [ ] Verificar que no hay timeout en consultas largas
- [ ] Tiempo máximo esperado: ~30-60 segundos primera consulta

---

## 12. UI/UX GENERAL

### 12.1 Sidebar
- [ ] Verificar todos los items del menú
- [ ] Verificar icono activo según página actual
- [ ] Colapsar/expandir sidebar

### 12.2 TopBar
- [ ] Verificar título de la página
- [ ] Verificar menú de usuario
- [ ] Verificar menú de notificaciones

### 12.3 Responsive
- [ ] Verificar en pantalla grande (1920px)
- [ ] Verificar en laptop (1366px)
- [ ] Verificar en tablet (768px)

### 12.4 Dark Mode (si aplica)
- [ ] Toggle de dark mode
- [ ] Verificar colores correctos

### 12.5 Loading States
- [ ] Verificar spinners durante carga
- [ ] Verificar skeletons en tablas

### 12.6 Error States
- [ ] Simular error de red
- [ ] **Esperado**: Mensaje de error amigable

---

## 13. PERFORMANCE

### 13.1 Tiempos de Carga
| Página | Tiempo Esperado |
|--------|-----------------|
| Login | < 1s |
| Dashboard | < 3s |
| Tabla de productos | < 2s |
| Ficha de producto | < 2s |
| StadiumGPT (primera) | < 60s |
| StadiumGPT (subsecuente) | < 15s |

### 13.2 Métricas de Red
- [ ] Abrir DevTools > Network
- [ ] Verificar que no hay requests fallidos (rojos)
- [ ] Verificar tamaño de bundle < 1MB

---

## 14. SEGURIDAD

### 14.1 Rutas Protegidas
- [ ] Intentar acceder a `/` sin login
- [ ] **Esperado**: Redirección a `/login`

### 14.2 Token JWT
- [ ] Verificar que token se envía en cookies
- [ ] Verificar que token tiene expiración

### 14.3 CORS
- [ ] Verificar que no hay errores de CORS

---

## Reporte de Bugs

Si encuentra un bug, documentar:
1. **URL/Página** donde ocurrió
2. **Pasos** para reproducir
3. **Resultado esperado**
4. **Resultado actual**
5. **Screenshot** si es visual
6. **Console errors** (F12 > Console)

---

## Comandos Útiles para Debug

```bash
# Ver logs en tiempo real (en servidor)
ssh -p 2224 aisrvadmin@179.27.76.130
pm2 logs stadium-dashboard

# Reiniciar aplicación
pm2 restart stadium-dashboard

# Ver estado de servicios
pm2 status
systemctl status nginx
systemctl status ollama

# Verificar conectividad a DB
curl http://localhost:3000/api/metrics -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: stadium-auth-token=TOKEN" \
  -d '{"startDate":"2025-01-01","endDate":"2025-01-29"}'
```

---

## Checklist Final

- [ ] Todos los tests de Login pasaron
- [ ] Todos los tests de Dashboard pasaron
- [ ] Todos los tests de Filtros pasaron
- [ ] Todos los tests de Tabla de Productos pasaron
- [ ] Todos los tests de Ficha de Producto (NUEVO) pasaron
- [ ] Todos los tests de Sell-Out (NUEVO) pasaron
- [ ] Todos los tests de Incidencias (NUEVO) pasaron
- [ ] Todos los tests de Recompra pasaron
- [ ] Todos los tests de Price Actions pasaron
- [ ] Todos los tests de StadiumGPT pasaron
- [ ] Performance aceptable
- [ ] Sin errores en consola
- [ ] UI responsive
