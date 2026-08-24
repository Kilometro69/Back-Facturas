/**
 * qr.js — Código QR del comprobante
 * -----------------------------------------------------------------------------
 * El anexo indica que la clave de 50 dígitos "se tiene que utilizar para la
 * consulta del código QR". El QR apunta al consultor público de Hacienda, de
 * modo que quien recibe el comprobante impreso pueda verificarlo escaneándolo.
 *
 * Se genera como data URI para que quede embebido en el HTML. Si se sirviera
 * desde una URL, Puppeteer tendría que esperar una descarga externa por cada
 * PDF, y un fallo de red dejaría el comprobante sin QR.
 * -----------------------------------------------------------------------------
 */

'use strict';

const QRCode = require('qrcode');

const URL_CONSULTA = process.env.URL_CONSULTA_HACIENDA
  || 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/comprobantes';

/** Texto que se codifica en el QR. */
function contenido(clave) {
  return `${URL_CONSULTA}/${clave}`;
}

/**
 * @param {string} clave  50 dígitos
 * @param {object} [opciones]
 * @returns {Promise<string|null>} data URI, o null si no se pudo generar
 */
async function generarQr(clave, opciones = {}) {
  if (!/^\d{50}$/.test(String(clave || ''))) return null;

  try {
    return await QRCode.toDataURL(contenido(clave), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,          // se escala por CSS; se genera grande para que
                           // no se vea pixelado al imprimir
      color: { dark: opciones.color || '#000000', light: '#ffffff' },
    });
  } catch (err) {
    // Un QR que falla no debe impedir emitir el comprobante: el QR es una
    // ayuda de verificación, no un requisito de la estructura.
    console.error('No se pudo generar el QR:', err.message);
    return null;
  }
}

module.exports = { generarQr, contenido, URL_CONSULTA };
