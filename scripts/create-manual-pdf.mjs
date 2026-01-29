import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = './manual-screenshots';
const OUTPUT_FILE = './Manual-Stadium-Dashboard.pdf';

// Contenido del manual
const manualContent = {
    titulo: 'MANUAL DE USUARIO\nStadium Dashboard',
    version: 'Versión 1.0 - Enero 2026',

    secciones: [
        {
            titulo: '1. INTRODUCCIÓN',
            contenido: `Stadium Dashboard es una plataforma integral de análisis de datos para retail que permite visualizar métricas de ventas, gestionar precios y obtener insights mediante inteligencia artificial.

Características principales:
• Dashboard interactivo con métricas en tiempo real
• Análisis comparativo de ventas (52 semanas vs Calendario)
• Gestión de recompra de productos
• Simulador de acciones de precios
• Asistente de IA (StadiumGPT)
• Alertas de stock y notificaciones`,
            imagen: null
        },
        {
            titulo: '2. ACCESO AL SISTEMA',
            subtitulo: '2.1 Inicio de Sesión',
            contenido: `Para acceder al sistema:

1. Abra su navegador web y navegue a la URL del dashboard
2. Ingrese su nombre de usuario en el campo "Usuario"
3. Ingrese su contraseña en el campo "Contraseña"
4. Haga clic en el botón "Iniciar Sesión"

Si olvidó su contraseña, contacte al administrador del sistema.`,
            imagen: '01-login.png'
        },
        {
            titulo: '3. DASHBOARD PRINCIPAL',
            subtitulo: '3.1 Vista General',
            contenido: `El dashboard principal muestra las métricas clave del negocio:

• Unidades Vendidas: Total de productos vendidos en el período
• Ventas Totales: Importe total de ventas en pesos
• Margen: Porcentaje de ganancia sobre ventas
• Markup: Porcentaje de ganancia sobre costo
• Stock Estimado: Inventario disponible

Cada métrica muestra:
- Valor actual del período seleccionado
- Comparación con período anterior
- Porcentaje de variación (crecimiento o decrecimiento)`,
            imagen: '03-dashboard-principal.png'
        },
        {
            titulo: '',
            subtitulo: '3.2 Selector de Fechas',
            contenido: `El selector de fechas permite definir el período de análisis:

1. Haga clic en el ícono de calendario en la barra superior
2. Seleccione la fecha de inicio
3. Seleccione la fecha de fin
4. El dashboard se actualizará automáticamente

También puede seleccionar rangos predefinidos:
• Hoy
• Últimos 7 días
• Últimos 30 días
• Este mes
• Mes anterior`,
            imagen: '07-selector-fechas.png'
        },
        {
            titulo: '4. CONFIGURACIÓN',
            subtitulo: '4.1 Menú de Configuración',
            contenido: `Acceda al menú de configuración haciendo clic en el ícono de tuerca (⚙️) en la barra superior.

Opciones disponibles:
• Modo Claro/Oscuro: Cambia el tema visual del dashboard
• Comparativo 52 Semanas/Calendario: Selecciona el modo de comparación
• Gestión de Usuarios: Solo disponible para administradores`,
            imagen: '04-menu-configuracion.png'
        },
        {
            titulo: '',
            subtitulo: '4.2 Modo de Comparación',
            contenido: `El sistema ofrece dos modos de comparación para analizar datos:

52 SEMANAS (Recomendado):
• Compara con exactamente 364 días atrás
• Mantiene el mismo día de la semana
• Ideal para análisis de tendencias semanales
• Ejemplo: Lunes vs Lunes del año anterior

CALENDARIO:
• Compara con la misma fecha del año anterior
• Usa el año calendario tradicional
• Ideal para análisis de fechas específicas
• Ejemplo: 15 de enero 2026 vs 15 de enero 2025

Para cambiar el modo:
1. Abra el menú de configuración (⚙️)
2. Haga clic en el switch "52 Semanas" / "Calendario"
3. Los datos se actualizarán automáticamente`,
            imagen: '05-switch-comparativo.png'
        },
        {
            titulo: '5. FILTROS',
            subtitulo: '5.1 Panel de Filtros',
            contenido: `Los filtros permiten segmentar los datos por diferentes dimensiones:

FILTROS DISPONIBLES:
• Tiendas: Filtra por punto de venta
• Marcas: Filtra por marca de producto
• Géneros: Filtra por género (Hombre, Mujer, Niño, etc.)
• Categorías: Filtra por tipo de producto
• Proveedores: Filtra por proveedor

USO DE FILTROS:
1. Haga clic en la categoría de filtro deseada
2. Seleccione uno o más valores
3. Los datos se actualizarán automáticamente
4. Para quitar un filtro, haga clic en la "X" junto al valor`,
            imagen: '06-filtros.png'
        },
        {
            titulo: '6. MÉTRICAS Y GRÁFICOS',
            subtitulo: '6.1 Tarjetas de Métricas',
            contenido: `Cada tarjeta de métrica muestra información detallada al pasar el cursor:

INFORMACIÓN MOSTRADA:
• Valor del período actual
• Valor del período anterior
• Variación porcentual
• Indicador visual (verde = positivo, rojo = negativo)

ACCIONES DISPONIBLES:
• Clic en la tarjeta: Expande detalles
• Menú de agrupación: Ver datos por tienda, marca, etc.`,
            imagen: '08-metrica-detalle.png'
        },
        {
            titulo: '',
            subtitulo: '6.2 Gráfico Comparativo',
            contenido: `El gráfico comparativo muestra la evolución de ventas:

CARACTERÍSTICAS:
• Línea azul: Período actual
• Línea gris: Período anterior (según modo de comparación)
• Eje X: Semanas del período
• Eje Y: Unidades o importe

INTERACCIÓN:
• Pase el cursor sobre los puntos para ver valores exactos
• Use los botones para alternar entre Unidades e Importe`,
            imagen: '09-grafico-comparativo.png'
        },
        {
            titulo: '7. ANÁLISIS DE PRODUCTOS',
            subtitulo: '7.1 Tabla de Análisis',
            contenido: `La tabla de análisis muestra el detalle de productos:

COLUMNAS DISPONIBLES:
• Código/Base: Identificador del producto
• Descripción: Nombre del producto
• Unidades: Cantidad vendida
• Ventas: Importe total
• Margen: Porcentaje de ganancia
• Stock: Inventario disponible

FUNCIONALIDADES:
• Ordenar por cualquier columna
• Buscar productos específicos
• Exportar datos a Excel
• Ver detalle del producto`,
            imagen: '10-tabla-analisis.png'
        },
        {
            titulo: '8. MÓDULO DE RECOMPRA',
            subtitulo: '8.1 Vista General',
            contenido: `El módulo de Recompra ayuda a identificar productos que necesitan reposición:

INDICADORES:
• Productos con stock bajo
• Velocidad de venta
• Días de cobertura
• Sugerencia de reposición

ACCIONES:
• Ver detalle de producto
• Agregar a lista de pedidos
• Exportar reporte`,
            imagen: '11-recompra.png'
        },
        {
            titulo: '9. ACCIONES DE PRECIOS',
            subtitulo: '9.1 Price Actions',
            contenido: `El módulo de Acciones de Precios permite gestionar cambios de precio:

FUNCIONALIDADES:
• Watchlist: Lista de productos a monitorear
• Simulador: Proyectar impacto de cambios de precio
• Propuestas: Crear y aprobar cambios de precio
• Historial: Ver cambios realizados

FLUJO DE TRABAJO:
1. Agregar productos a la Watchlist
2. Simular cambios de precio
3. Crear propuesta de cambio
4. Aprobar/Rechazar propuesta
5. Ejecutar cambio`,
            imagen: '12-price-actions.png'
        },
        {
            titulo: '',
            subtitulo: '9.2 Simulador de Precios',
            contenido: `El simulador permite proyectar el impacto de cambios de precio:

PARÁMETROS:
• Precio actual vs precio propuesto
• Elasticidad estimada
• Proyección de ventas
• Impacto en margen

RESULTADOS:
• Gráfico de proyección
• Cambio estimado en unidades
• Cambio estimado en ingresos
• Cambio estimado en margen`,
            imagen: '13-simulador-precios.png'
        },
        {
            titulo: '10. STADIUMGPT (Asistente IA)',
            subtitulo: '10.1 Chat con IA',
            contenido: `StadiumGPT es el asistente de inteligencia artificial del sistema:

CAPACIDADES:
• Responder preguntas sobre los datos
• Generar análisis automáticos
• Crear consultas SQL
• Explicar métricas y tendencias

EJEMPLOS DE USO:
• "¿Cuáles son los productos más vendidos este mes?"
• "Compara las ventas de Nike vs Adidas"
• "¿Qué productos tienen bajo stock?"
• "Genera un análisis de la marca X"

CÓMO USAR:
1. Escriba su pregunta en el campo de texto
2. Presione Enter o haga clic en Enviar
3. Espere la respuesta del asistente`,
            imagen: '14-stadiumgpt.png'
        },
        {
            titulo: '11. NOTIFICACIONES',
            subtitulo: '11.1 Centro de Alertas',
            contenido: `El sistema genera alertas automáticas para situaciones importantes:

TIPOS DE ALERTAS:
• Stock bajo: Productos que necesitan reposición
• Quiebre de stock: Productos sin inventario
• Variaciones significativas: Cambios importantes en ventas

GESTIÓN DE ALERTAS:
1. Haga clic en el ícono de campana (🔔)
2. Revise las alertas pendientes
3. Haga clic en una alerta para ver detalles
4. Marque como leída o tome acción`,
            imagen: '16-notificaciones.png'
        },
        {
            titulo: '12. GESTIÓN DE USUARIOS',
            subtitulo: '12.1 Administración (Solo Admins)',
            contenido: `Los administradores pueden gestionar usuarios del sistema:

FUNCIONES:
• Crear nuevos usuarios
• Editar usuarios existentes
• Cambiar contraseñas
• Asignar roles (Admin, Usuario, Visualizador)
• Desactivar usuarios

ROLES DISPONIBLES:
• Administrador: Acceso completo
• Usuario: Acceso a dashboard y reportes
• Visualizador: Solo lectura`,
            imagen: '17-menu-usuario.png'
        },
        {
            titulo: '13. ATAJOS Y TIPS',
            contenido: `ATAJOS ÚTILES:
• Doble clic en métrica: Ver detalle expandido
• Clic derecho en tabla: Menú contextual
• Scroll en gráficos: Zoom temporal

TIPS DE PRODUCTIVIDAD:
• Use filtros combinados para análisis específicos
• Guarde consultas frecuentes en StadiumGPT
• Revise alertas diariamente
• Compare siempre con el período adecuado

MEJORES PRÁCTICAS:
• Inicie el día revisando el dashboard
• Configure alertas para productos críticos
• Use el modo "52 semanas" para análisis de tendencias
• Use el modo "Calendario" para fechas específicas`,
            imagen: null
        },
        {
            titulo: '14. SOPORTE',
            contenido: `Para obtener ayuda adicional:

CONTACTO:
• Soporte técnico: soporte@stadium.com
• Administrador del sistema: Consulte con su supervisor

RECURSOS:
• Este manual está disponible en formato digital
• Videos tutoriales disponibles en la intranet

REPORTAR PROBLEMAS:
1. Describa el problema detalladamente
2. Incluya capturas de pantalla si es posible
3. Indique los pasos para reproducir el error
4. Envíe al equipo de soporte`,
            imagen: null
        }
    ]
};

async function generatePDF() {
    console.log('Generando Manual PDF...\n');

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
            Title: 'Manual de Usuario - Stadium Dashboard',
            Author: 'Stadium Analytics',
            Subject: 'Manual de Usuario',
            Keywords: 'dashboard, analytics, manual, stadium'
        }
    });

    const stream = fs.createWriteStream(OUTPUT_FILE);
    doc.pipe(stream);

    // Colores
    const primaryColor = '#1e40af';
    const secondaryColor = '#475569';
    const accentColor = '#3b82f6';

    // Página de título
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');

    doc.fontSize(42)
        .fillColor('#ffffff')
        .text('STADIUM', 50, 200, { align: 'center' });

    doc.fontSize(36)
        .fillColor(accentColor)
        .text('DASHBOARD', 50, 260, { align: 'center' });

    doc.fontSize(24)
        .fillColor('#94a3b8')
        .text('Manual de Usuario', 50, 340, { align: 'center' });

    doc.fontSize(14)
        .fillColor('#64748b')
        .text(manualContent.version, 50, 700, { align: 'center' });

    // Índice
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
    doc.fontSize(24)
        .fillColor('#ffffff')
        .text('ÍNDICE', 50, 30);

    doc.fillColor(secondaryColor);
    let yPos = 120;

    manualContent.secciones.forEach((seccion, index) => {
        if (seccion.titulo) {
            doc.fontSize(12)
                .fillColor(primaryColor)
                .text(seccion.titulo, 50, yPos);
            yPos += 25;
        }
        if (seccion.subtitulo) {
            doc.fontSize(10)
                .fillColor(secondaryColor)
                .text(`    ${seccion.subtitulo}`, 50, yPos);
            yPos += 20;
        }

        if (yPos > 700) {
            doc.addPage();
            yPos = 50;
        }
    });

    // Contenido
    for (const seccion of manualContent.secciones) {
        doc.addPage();

        // Header de sección
        if (seccion.titulo) {
            doc.rect(0, 0, doc.page.width, 70).fill(primaryColor);
            doc.fontSize(20)
                .fillColor('#ffffff')
                .text(seccion.titulo, 50, 25);
        }

        let contentY = seccion.titulo ? 90 : 50;

        // Subtítulo
        if (seccion.subtitulo) {
            doc.fontSize(16)
                .fillColor(accentColor)
                .text(seccion.subtitulo, 50, contentY);
            contentY += 30;
        }

        // Contenido de texto
        if (seccion.contenido) {
            doc.fontSize(11)
                .fillColor('#334155')
                .text(seccion.contenido, 50, contentY, {
                    width: 495,
                    align: 'justify',
                    lineGap: 4
                });
            contentY = doc.y + 20;
        }

        // Imagen
        if (seccion.imagen) {
            const imagePath = path.join(SCREENSHOTS_DIR, seccion.imagen);
            if (fs.existsSync(imagePath)) {
                // Calcular tamaño de imagen
                const maxWidth = 495;
                const maxHeight = 300;

                try {
                    doc.image(imagePath, 50, contentY, {
                        fit: [maxWidth, maxHeight],
                        align: 'center'
                    });

                    // Borde alrededor de la imagen
                    doc.rect(50, contentY, maxWidth, maxHeight)
                        .stroke('#e2e8f0');

                    console.log(`  ✓ Imagen agregada: ${seccion.imagen}`);
                } catch (err) {
                    console.log(`  ✗ Error con imagen: ${seccion.imagen}`);
                    doc.fontSize(10)
                        .fillColor('#ef4444')
                        .text(`[Imagen: ${seccion.imagen}]`, 50, contentY);
                }
            } else {
                // Placeholder para imagen faltante
                doc.rect(50, contentY, 495, 200)
                    .fill('#f1f5f9')
                    .stroke('#e2e8f0');
                doc.fontSize(12)
                    .fillColor('#94a3b8')
                    .text(`[Captura: ${seccion.imagen}]`, 50, contentY + 90, {
                        width: 495,
                        align: 'center'
                    });
                console.log(`  ⚠ Imagen pendiente: ${seccion.imagen}`);
            }
        }
    }

    // Página final
    doc.addPage();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');

    doc.fontSize(24)
        .fillColor('#ffffff')
        .text('Stadium Dashboard', 50, 300, { align: 'center' });

    doc.fontSize(14)
        .fillColor('#64748b')
        .text('Gracias por usar nuestro sistema', 50, 350, { align: 'center' });

    doc.fontSize(12)
        .fillColor('#475569')
        .text('Para soporte: soporte@stadium.com', 50, 400, { align: 'center' });

    // Finalizar
    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => {
            console.log(`\n✓ PDF generado: ${path.resolve(OUTPUT_FILE)}`);
            resolve();
        });
        stream.on('error', reject);
    });
}

generatePDF().catch(console.error);
