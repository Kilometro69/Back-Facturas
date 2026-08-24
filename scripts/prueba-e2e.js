/**
 * prueba-e2e.js — Prueba de extremo a extremo de la lógica de emisión
 * -----------------------------------------------------------------------------
 * Corre sin MongoDB ni Puppeteer reales: se simulan ambos (ver más abajo) para
 * poder validar la lógica central (emitir, numerar, notas de crédito, validar)
 * en cualquier máquina, sin levantar infraestructura.
 * -----------------------------------------------------------------------------
 */

'use strict';
process.env.JWT_SECRET = 'prueba-e2e';

// Simulamos Mongo y Puppeteer para probar la lógica de emisión sin infraestructura.
const Module = require('module');
const originalRequire = Module.prototype.require;

const contadores = {};
const documentos = [];

const modelosFalsos = {
  Counter: { siguiente: async (llave) => { contadores[llave] = (contadores[llave] || 0) + 1; return contadores[llave]; } },
  Template: { findOne: () => ({ sort: async () => null, then: (r) => r(null) }) },
  Document: { create: async (d) => { documentos.push(d); return { ...d, _id: 'doc' + documentos.length, save: async () => {} }; } },
  Tenant: {}, User: {}, TemplateModel: {}, Catalog: {},
};

let ultimoHtml = null;

Module.prototype.require = function (ruta) {
  if (ruta.endsWith('db/models')) return modelosFalsos;
  if (ruta.endsWith('render/pdf')) return {
    generarPdf: async (html) => { ultimoHtml = html; return Buffer.from('%PDF-falso'); },
    cerrar: async () => {},
  };
  if (ruta === 'qrcode') return { toDataURL: async () => 'data:image/png;base64,QRFALSO' };
  return originalRequire.apply(this, arguments);
};

const almacen = require('../src/storage/almacen');
almacen.guardarPdf = async (t, c, b) => ({ ruta: `local/${c}.pdf`, bytes: b.length, backend: 'local' });

const emision = require('../src/services/emision');

const tenant = {
  _id: 'tenant1', nombre: 'Asociación Deportiva Ejemplo', nombreComercial: 'Club Ejemplo FC',
  identificacion: { tipo: '02', numero: '3101123456' }, codigoActividad: '931201',
  ubicacion: { provincia: '6', canton: '01', distrito: '01', otrasSenas: 'Estadio municipal' },
  correos: ['admin@club.cr'], local: 1, terminal: 1,
  adaptadores: [], plantillaPorDefecto: null,
};

// Se usa el ejemplo del propio adaptador del catálogo: si el catálogo cambia
// sus campos, la prueba lo sigue y no queda validando una forma que ya no existe.
const catalogo = require('../src/catalogoAdaptadores');
const entradaClub = JSON.parse(JSON.stringify(catalogo.obtener('multa').ejemploEntrada));
const copiaOriginal = JSON.parse(JSON.stringify(entradaClub));

(async () => {
  console.log('=== 1. Emisión con adaptador ===');
  const d1 = await emision.emitir({ tenant, entrada: entradaClub, adaptador: 'multa' });
  console.log('clave:', d1.clave.length, 'dígitos |', d1.clave.slice(0, 20) + '...');
  console.log('consecutivo:', d1.consecutivo);
  console.log('total:', d1.totalComprobante);
  console.log('receptor:', d1.receptorNombre, '/', d1.receptorCedula);
  console.log('entrada NO mutada:', JSON.stringify(entradaClub) === JSON.stringify(copiaOriginal));

  console.log('\n=== 2. Secuencia continua ===');
  const d2 = await emision.emitir({ tenant, entrada: entradaClub, adaptador: 'multa' });
  const d3 = await emision.emitir({ tenant, entrada: entradaClub, adaptador: 'multa' });
  console.log([d1, d2, d3].map(d => d.consecutivo.slice(-4)).join(' -> '));
  console.log('claves distintas:', new Set([d1.clave, d2.clave, d3.clave]).size === 3);

  console.log('\n=== 3. Validación falla y NO gasta consecutivo ===');
  const antes = contadores['tenant1:001:00001:FE'];
  try {
    await emision.emitir({ tenant, entrada: { condicionVenta: '01' } });
    console.log('REVISAR: debió fallar');
  } catch (err) {
    console.log('error:', err.codigo, '|', err.errores.length, 'campos');
    console.log('primeros:', err.errores.slice(0, 3).map(e => e.campo).join(', '));
  }
  console.log('consecutivo no avanzó:', contadores['tenant1:001:00001:FE'] === antes);

  console.log('\n=== 4. Nota de crédito ===');
  const original = { ...d1, estado: 'emitido', payload: documentos[0].payload,
    fechaEmision: new Date(documentos[0].fechaEmision), tipoComprobante: 'FE',
    plantillaSnapshot: documentos[0].plantillaSnapshot, tenantId: 'tenant1',
    save: async () => {} };
  const nc = await emision.emitirNotaCredito({ tenant, original, razon: 'Multa apelada y revocada' });
  console.log('tipo:', nc.tipoComprobante, '| consecutivo:', nc.consecutivo);
  console.log('código en posición 9-10:', nc.consecutivo.slice(8, 10), '(03 = nota de crédito)');
  console.log('referencia al original:', nc.payload.informacionReferencia[0].numero === d1.clave);
  console.log('original quedó anulado:', original.estado === 'anulado');

  console.log('\n=== 5. HTML del PDF ===');
  console.log('marca ANULADO:', ultimoHtml.includes('class="comprobante anulado"'));
  console.log('descripción, no código:', ultimoHtml.includes('Multas o Penalizaciones'));
  console.log('ubicación resuelta:', ultimoHtml.includes('Puntarenas'));

  console.log('\n=== 6. Razón obligatoria ===');
  try { await emision.emitirNotaCredito({ tenant, original: { ...original, estado: 'emitido' }, razon: 'x' }); }
  catch (e) { console.log('rechazado:', e.codigo); }
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
