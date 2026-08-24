/**
 * almacen.js — Almacenamiento de PDFs en MongoDB
 * -----------------------------------------------------------------------------
 * Los comprobantes se guardan como binario en la colección `pdffiles`, junto
 * con todo lo demás (Tenant, Document, etc.): un solo lugar que respaldar, sin
 * bucket externo ni credencial aparte que custodiar.
 *
 * POR QUÉ NO GridFS: parte los archivos en trozos de 255 KB para superar el
 * límite de 16 MB de BSON. Un comprobante pesa entre 30 y 200 KB, así que
 * GridFS agregaría dos colecciones y una lectura fragmentada sin ganancia.
 *
 * Los PDFs se entregan como bytes directos en la respuesta HTTP de
 * routes/documents.js: este módulo solo guarda y lee, nunca genera un enlace.
 * -----------------------------------------------------------------------------
 */

'use strict';

const { PdfFile } = require('../db/models');

// BSON tope 16 MB. Se avisa antes de llegar, porque el error de Mongo al
// superarlo es críptico y aparece lejos de su causa.
const LIMITE_AVISO = 8 * 1024 * 1024;
const LIMITE_DURO = 15 * 1024 * 1024;

/**
 * Guarda un PDF y devuelve su ubicación. Si ya existe uno con la misma clave,
 * lo reemplaza: es lo que pasa al regenerar un comprobante anulado.
 * @returns {Promise<{ ruta: string, bytes: number, backend: string }>}
 */
async function guardarPdf(tenantId, clave, buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('El PDF está vacío');
  }
  if (buffer.length > LIMITE_DURO) {
    throw new Error(
      `El PDF pesa ${(buffer.length / 1048576).toFixed(1)} MB y no cabe en un documento de MongoDB. ` +
      'Revise el tamaño del logo de la plantilla.'
    );
  }
  if (buffer.length > LIMITE_AVISO) {
    console.warn(`PDF grande (${(buffer.length / 1048576).toFixed(1)} MB) para la clave ${clave}`);
  }

  await PdfFile.findOneAndUpdate(
    { clave },
    {
      clave,
      tenantId,
      contenido: buffer,
      bytes: buffer.length,
      contentType: 'application/pdf',
      generadoEn: new Date(),
    },
    { upsert: true }
  );

  return { ruta: `mongo://pdffiles/${clave}`, bytes: buffer.length, backend: 'mongo' };
}

/**
 * Lee el PDF. Se filtra por tenant además de por clave: la clave es única a
 * nivel global, pero un tenant no debe poder leer el archivo de otro ni por
 * error de programación en la capa de arriba.
 */
async function leerPdf(tenantId, clave) {
  const archivo = await PdfFile.findOne({ clave, tenantId: String(tenantId) })
    .select('contenido')
    .lean();

  if (!archivo) throw new Error(`No existe el PDF de la clave ${clave}`);

  const { contenido } = archivo;
  // Con .lean(), el driver normalmente ya devuelve un Buffer nativo -- se
  // retorna tal cual, sin tocarlo. Si en cambio llega envuelto en un objeto
  // Binary de BSON (tiene .buffer, pero NO es un Buffer en sí), hay que
  // extraerlo respetando byteOffset/byteLength: un Buffer/Uint8Array siempre
  // tiene una propiedad .buffer (apunta al ArrayBuffer completo, que puede
  // ser más grande que los bytes reales por el "pooling" de Node), así que
  // usar ese atajo a ciegas corrompe el archivo cuando el buffer es chico.
  if (Buffer.isBuffer(contenido)) return contenido;
  return Buffer.from(contenido.buffer, contenido.byteOffset, contenido.byteLength);
}

async function existePdf(tenantId, clave) {
  const n = await PdfFile.countDocuments({ clave, tenantId: String(tenantId) }).limit(1);
  return n > 0;
}

/**
 * Borrado. Ojo: un comprobante emitido NO se borra, se anula con nota de
 * crédito. Esto es solo para limpiar pruebas y desarrollo.
 */
async function borrarPdf(tenantId, clave) {
  await PdfFile.deleteOne({ clave, tenantId: String(tenantId) });
}

module.exports = {
  guardarPdf,
  leerPdf,
  existePdf,
  borrarPdf,
  get backend() { return 'mongo'; },
};
