import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'http://179.27.76.130:8024';
const CREDENTIALS = { usuario: 'admin', password: 'admin123' };
const SCREENSHOTS_DIR = './manual-screenshots';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureMissing() {
    console.log('Capturando imágenes faltantes...');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1920, height: 1080 },
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        // Login
        console.log('Iniciando sesión...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await delay(1000);
        await page.type('input[type="text"], input[name="usuario"]', CREDENTIALS.usuario);
        await page.type('input[type="password"]', CREDENTIALS.password);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await delay(3000);

        // Captura de filtros - buscar en el sidebar
        console.log('Capturando filtros...');
        // Intentar hacer clic en un elemento del sidebar que abra filtros
        const sidebarItems = await page.$$('nav button, aside button, [class*="sidebar"] button');
        if (sidebarItems.length > 0) {
            await sidebarItems[1].click(); // Click en segundo item (posiblemente filtros)
            await delay(1000);
        }
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-filtros.png`, fullPage: false });

        // Captura de métrica con hover
        console.log('Capturando métrica con detalle...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
        await delay(2000);

        // Buscar tarjetas de métricas y hacer hover
        const cards = await page.$$('[class*="card"], [class*="Card"], [class*="metric"], [class*="Metric"]');
        if (cards.length > 0) {
            const box = await cards[0].boundingBox();
            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await delay(800);
            }
        }
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-metrica-detalle.png`, fullPage: false });

        console.log('Capturas adicionales completadas');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await delay(2000);
        await browser.close();
    }
}

captureMissing().catch(console.error);
