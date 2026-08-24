/**
 * pdf.js — Impresión de HTML a PDF con Puppeteer
 * -----------------------------------------------------------------------------
 * Se reutiliza una sola instancia del navegador. Lanzar Chromium por cada
 * factura toma entre 1 y 2 segundos y consume unos 100 MB: con volumen real
 * eso tumba el servidor.
 *
 * El HTML es el mismo que ve el editor en su preview. Esa es la razón de usar
 * Puppeteer en vez de una librería que dibuje el PDF por coordenadas: el
 * diseño se escribe una sola vez, en CSS.
 * -----------------------------------------------------------------------------
 */

'use strict';

const puppeteer = require('puppeteer');

let navegadorPromesa = null;
let paginasGeneradas = 0;

// Chromium acumula memoria. Se recicla cada tantas páginas para que un proceso
// de larga vida no crezca sin límite.
const MAX_PAGINAS_POR_NAVEGADOR = 500;

const OPCIONES_LANZAMIENTO = {
  headless: true, // 'new' quedó obsoleto desde Puppeteer v22; true ya es el modo "new" headless
  args: [
    '--no-sandbox',                  // requerido en contenedores
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',       // /dev/shm es diminuto en Docker
    '--disable-gpu',
    '--font-render-hinting=none',    // tipografía consistente entre máquinas
  ],
};

// obtenerNavegador: reutiliza una sola instancia de Chrome entre PDFs (lanzarlo de cero por
// cada comprobante tarda 1-2 seg y consume ~100 MB); se recicla cada MAX_PAGINAS_POR_NAVEGADOR
// páginas porque Chromium acumula memoria con el uso.
async function obtenerNavegador() {
  if (navegadorPromesa) {
    const nav = await navegadorPromesa;
    if (nav.connected !== false && paginasGeneradas < MAX_PAGINAS_POR_NAVEGADOR) return nav;

    // Reciclar
    paginasGeneradas = 0;
    navegadorPromesa = null;
    await nav.close().catch(() => {});
  }

  navegadorPromesa = puppeteer.launch(OPCIONES_LANZAMIENTO);
  return navegadorPromesa;
}

/**
 * @param {string} html
 * @param {object} [opciones]
 * @returns {Promise<Buffer>}
 */
async function generarPdf(html, opciones = {}) {
  const navegador = await obtenerNavegador();
  const pagina = await navegador.newPage();

  try {
    // 'networkidle0' espera a que carguen imágenes remotas: el logo del tenant
    // vive en una URL externa y sin esto sale un PDF con el hueco vacío.
    await pagina.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    // Las fuentes web se cargan después del HTML; sin esto el texto puede
    // imprimirse con la tipografía de reemplazo.
    await pagina.evaluateHandle('document.fonts.ready');

    const pdf = await pagina.pdf({
      format: 'A4',
      printBackground: true,   // sin esto se pierden los colores del tenant
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }, // los márgenes van en CSS
      ...opciones,
    });

    paginasGeneradas++;
    // Desde Puppeteer 23, page.pdf() devuelve un Uint8Array, no un Buffer de Node (cambio
    // deliberado para no depender de APIs específicas de Node). Buffer.from(uint8Array) copia
    // los bytes a un Buffer real: el resto del código (almacen.js, mongoose) asume Buffer.
    return Buffer.from(pdf);
  } finally {
    await pagina.close().catch(() => {});
  }
}

/** Cierre ordenado. Se llama al apagar el servidor. */
async function cerrar() {
  if (!navegadorPromesa) return;
  const nav = await navegadorPromesa.catch(() => null);
  navegadorPromesa = null;
  paginasGeneradas = 0;
  if (nav) await nav.close().catch(() => {});
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.once(senal, () => { cerrar().finally(() => process.exit(0)); });
}

module.exports = { generarPdf, cerrar };
