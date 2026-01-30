# 🚀 Stadium Dashboard - Release Notes

---

## v2.1.0 - 29 de Enero 2026

**Build:** Producción
**URL:** http://179.27.76.130/

### 🆕 Nuevas Funcionalidades

#### 1. Sistema de Comparativas en Tarjetas de KPIs
- **Click en tarjeta** → Muestra tabla comparativa detallada
- **Colores semafóricos:** Verde (↑) / Rojo (↓) vs período anterior
- **Efecto Apple Intelligence:** Highlight animado azul/púrpura al crear tabla
- **Auto-scroll** a la tabla recién creada

#### 2. Badges de Clasificación de Productos
Nueva clasificación visual de productos según rotación:

| Badge | Significado | Criterio |
|-------|-------------|----------|
| 🟢 **FAST** | Alta rotación | >80% vendido |
| 🟡 **OK** | Rotación normal | 50-80% vendido |
| 🔴 **SLOW** | Baja rotación | 20-50% vendido |
| ⚫ **BURN** | Producto problemático | <20% vendido |

#### 3. Ficha de Producto Mejorada (Estilo CYBE)
- **Layout rediseñado:** Imagen + Métricas + Top Ventas en 3 columnas
- **KPI % Vendido:** Muestra porcentaje de unidades vendidas vs compradas
- **Top Ventas por Tienda:** Tabla compacta scrolleable (esquina superior derecha)
- **Miniaturas de colores:** Click para cambiar variante de color
- **Soporte tema Dark/Light:** Todos los elementos respetan el tema activo

#### 4. Tabla Unificada Stock + Ventas por Talla
- **Layout horizontal:** Stock y Ventas lado a lado (10 cols para 5 talles)
- **Header doble:** Sección STOCK 📦 | Sección VENTAS 💰
- **Celdas ROJAS:** Alertas visuales cuando:
  - Stock = 0 en tienda
  - Stock > 0 en Central
  - → Indica oportunidad de reabastecimiento

#### 5. Módulo Sell-Out
- **Nueva página** dedicada al análisis de sell-out
- **Clasificación automática** de productos por estado
- **Resumen de "clavos"** (productos de baja rotación)
- **Recomendaciones** de liquidación

#### 6. Sistema de Incidencias y Alertas
- **Detección automática** de productos que necesitan reabastecimiento
- **Panel de incidencias** con acciones rápidas
- **Botones Aprobar/Ignorar** para gestión de alertas
- **Severidad:** Crítica / Alta / Media

#### 7. StadiumGPT - Asistente IA
- Consultas en lenguaje natural sobre datos de ventas
- Integración con el dashboard para contexto automático

### 🐛 Bugs Corregidos

#### DateRangePicker - Zona Horaria
- **Problema:** Seleccionar "Este Mes" mostraba desde 31/12 en vez del día 1
- **Causa:** Conversión a UTC alteraba la fecha en zonas horarias negativas
- **Solución:** Nueva función `formatDateLocal()` sin conversión UTC

#### ProductDetail - Tema Oscuro
- **Problema:** Modal mostraba fondo blanco fijo ignorando tema dark
- **Solución:** Clases `dark:` agregadas a todos los elementos

### 🎨 Mejoras de UI/UX

| Área | Mejora |
|------|--------|
| Tablas | Highlight estilo Apple Intelligence |
| Scrollbars | Custom scrollbar para ambos temas |
| Métricas | Colores condicionales según valores |
| Badges | Indicadores visuales de estado |
| Layout | Grid responsivo optimizado |

### 📁 Archivos Modificados

```
src/components/
├── DateRangePicker.tsx      (fix zona horaria)
├── PinnedMetricTable.tsx    (highlight + scroll)
├── ProductDetail.tsx        (layout + dark mode)
├── ProductDetail/
│   ├── ProductMetricsGrid.tsx   (% vendido)
│   └── UnifiedTallaTable.tsx    (layout horizontal)
├── MetricCard.tsx
├── Sidebar.tsx
└── ProductStatusBadge.tsx

src/app/
├── page.tsx                 (isNew prop)
├── globals.css              (animaciones + scrollbar)
├── sell-out/page.tsx
└── api/
    ├── product/[id]/route.ts    (unidadesCompradas)
    ├── metrics/details/route.ts
    ├── sell-out/route.ts
    └── incidencias/route.ts
```

---

## 📋 Guía de Testing Rápido

### Fase 1: Autenticación
- [ ] Login: `admin` / `admin123`
- [ ] Verificar redirección al dashboard

### Fase 2: Dashboard Principal
- [ ] Verificar 6 tarjetas de métricas
- [ ] **NUEVO:** Click en tarjeta → tabla con colores verde/rojo
- [ ] Verificar gráfico comparativo 52 semanas

### Fase 3: Filtros
- [ ] Filtro por tienda
- [ ] Filtro por marca
- [ ] **FIX:** Selector "Este Mes" (debe empezar día 1)

### Fase 4: Tabla de Productos
- [ ] Scroll a tabla de productos
- [ ] **NUEVO:** Verificar badges Fast/OK/Slow/Burn
- [ ] Click en producto para abrir ficha

### Fase 5: Ficha de Producto
- [ ] Verificar imagen y métricas estilo CYBE
- [ ] Verificar miniaturas de colores relacionados
- [ ] **NUEVO:** Tabla unificada Stock+Ventas horizontal
- [ ] **NUEVO:** Celdas ROJAS (stock 0 + hay en central)
- [ ] **NUEVO:** % Vendido vs Comprado
- [ ] **NUEVO:** Top Ventas compacto arriba derecha
- [ ] **FIX:** Probar tema Dark y Light

### Fase 6: Sell-Out
- [ ] Click "Sell Out" en sidebar
- [ ] Verificar clasificación de productos
- [ ] Verificar resumen de clavos

### Fase 7: Incidencias
- [ ] Verificar alertas de reabastecimiento
- [ ] Probar botones Aprobar/Ignorar

### Fase 8: StadiumGPT
- [ ] Probar consulta en lenguaje natural

---

## v2.0.0 - 28 de Enero 2026

**Commit:** `8d7e517`

### Funcionalidades Iniciales
- Dashboard de Ventas con KPIs principales
- Filtros por tienda, marca, período
- Gráficos comparativos (52 semanas)
- Tabla de análisis de productos
- Ficha de producto detallada
- Sistema de autenticación
- Soporte tema Dark/Light

---

**Desarrollado con Claude Code** 🤖
