import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://179.27.76.130:8024';
const CREDENTIALS = { usuario: 'admin', password: 'admin123' };
const SCREENSHOTS_DIR = './manual-screenshots';

// Crear directorio de capturas
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshots() {
    console.log('Iniciando navegador...');

    const browser = await puppeteer.launch({
        headless: false, // Mostrar navegador para ver el proceso
        defaultViewport: { width: 1920, height: 1080 },
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        // 1. Página de Login
        console.log('1. Capturando página de login...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await delay(1000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login.png`, fullPage: false });

        // 2. Hacer login
        console.log('2. Iniciando sesión...');
        await page.type('input[type="text"], input[name="usuario"]', CREDENTIALS.usuario);
        await page.type('input[type="password"]', CREDENTIALS.password);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-login-filled.png`, fullPage: false });

        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await delay(3000);

        // 3. Dashboard principal
        console.log('3. Capturando dashboard principal...');
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-dashboard-principal.png`, fullPage: false });

        // 4. Menú de configuración (tuerca)
        console.log('4. Capturando menú de configuración...');
        const settingsButton = await page.$('button:has(svg.lucide-settings), [class*="settings"]');
        if (settingsButton) {
            await settingsButton.click();
            await delay(500);
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-menu-configuracion.png`, fullPage: false });
        }

        // 5. Switch de comparativo 52 semanas / Calendario
        console.log('5. Capturando switch de comparativo...');
        // Click en el switch para mostrar cambio
        const comparisonSwitch = await page.$('button:has(.lucide-rotate-ccw), button:has(.lucide-calendar-days)');
        if (comparisonSwitch) {
            await comparisonSwitch.click();
            await delay(500);
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-switch-comparativo.png`, fullPage: false });
        }

        // Cerrar menú de configuración
        await page.click('body');
        await delay(500);

        // 6. Filtros
        console.log('6. Capturando panel de filtros...');
        const filterPanel = await page.$('[class*="filter"], [class*="Filter"]');
        if (filterPanel) {
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-filtros.png`, fullPage: false });
        }

        // 7. DatePicker
        console.log('7. Capturando selector de fechas...');
        const datePicker = await page.$('[class*="date"], button:has(.lucide-calendar)');
        if (datePicker) {
            await datePicker.click();
            await delay(500);
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-selector-fechas.png`, fullPage: false });
            await page.click('body');
            await delay(300);
        }

        // 8. Métricas detalladas - hover en una métrica
        console.log('8. Capturando métricas con detalle...');
        const metricCard = await page.$('[class*="MetricCard"], [class*="metric"]');
        if (metricCard) {
            await metricCard.hover();
            await delay(500);
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-metrica-detalle.png`, fullPage: false });
        }

        // 9. Gráfico comparativo
        console.log('9. Capturando gráfico comparativo...');
        await page.evaluate(() => window.scrollTo(0, 500));
        await delay(500);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-grafico-comparativo.png`, fullPage: false });

        // 10. Tabla de análisis
        console.log('10. Capturando tabla de análisis...');
        await page.evaluate(() => window.scrollTo(0, 800));
        await delay(500);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-tabla-analisis.png`, fullPage: false });

        // 11. Página de Recompra
        console.log('11. Navegando a Recompra...');
        await page.goto(`${BASE_URL}/recompra`, { waitUntil: 'networkidle2' });
        await delay(2000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-recompra.png`, fullPage: false });

        // 12. Página de Price Actions
        console.log('12. Navegando a Price Actions...');
        await page.goto(`${BASE_URL}/price-actions`, { waitUntil: 'networkidle2' });
        await delay(2000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-price-actions.png`, fullPage: false });

        // 13. Simulador de precios (si está disponible)
        console.log('13. Capturando simulador de precios...');
        await page.evaluate(() => window.scrollTo(0, 300));
        await delay(500);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-simulador-precios.png`, fullPage: false });

        // 14. Página de Chat/StadiumGPT
        console.log('14. Navegando a StadiumGPT...');
        await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle2' });
        await delay(2000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/14-stadiumgpt.png`, fullPage: false });

        // 15. Volver al dashboard y captura completa
        console.log('15. Captura completa del dashboard...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
        await delay(2000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/15-dashboard-completo.png`, fullPage: true });

        // 16. Menú de notificaciones
        console.log('16. Capturando notificaciones...');
        const bellButton = await page.$('button:has(.lucide-bell)');
        if (bellButton) {
            await bellButton.click();
            await delay(500);
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/16-notificaciones.png`, fullPage: false });
            await page.click('body');
        }

        // 17. Menú de usuario
        console.log('17. Capturando menú de usuario...');
        const userMenu = await page.$('[class*="avatar"], button:has(.lucide-chevron-down)');
        if (userMenu) {
            await userMenu.click();
            await delay(500);
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/17-menu-usuario.png`, fullPage: false });
        }

        console.log('\n=== Capturas completadas ===');
        console.log(`Guardadas en: ${path.resolve(SCREENSHOTS_DIR)}`);

        // Listar capturas
        const files = fs.readdirSync(SCREENSHOTS_DIR);
        console.log('\nArchivos generados:');
        files.forEach(f => console.log(`  - ${f}`));

    } catch (error) {
        console.error('Error durante las capturas:', error);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/error-screenshot.png`, fullPage: true });
    } finally {
        console.log('\nCerrando navegador en 5 segundos...');
        await delay(5000);
        await browser.close();
    }
}

// Ejecutar
takeScreenshots().catch(console.error);
