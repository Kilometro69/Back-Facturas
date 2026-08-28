/**
 * documents.js — API para sistemas cliente
 * -----------------------------------------------------------------------------
 * Todo acá se autentica con API key. El panel web NO emite comprobantes: eso lo
 * hace el sistema del cliente, que es quien tiene el contexto del negocio.
 *
 * Sobre la entrega del PDF: se devuelven los bytes directamente
 * (Content-Type: application/pdf) en la misma respuesta que emite o consulta el
 * documento. Los metadatos del comprobante (id, clave, consecutivo, total,
 * estado, receptor) viajan en encabezados X-* porque el cuerpo de la respuesta
 * ya es el PDF. Esto evita una segunda llamada y una URL de corta duración que
 * el cliente tenía que reenviar a su frontend antes de que caducara.
 * -----------------------------------------------------------------------------
 */

'use strict';

const express = require('express');
const { Document } = require('../db/models');
const { autenticarApiKey } = require('../middleware/auth');
const emision = require('../services/emision');
const almacen = require('../storage/almacen');

const router = express.Router();
router.use(autenticarApiKey);

/** Forma pública de un documento. Nunca se expone el payload completo por defecto. */
function resumenDocumento(doc) {
  return {
    id: String(doc._id),
    clave: doc.clave,
    consecutivo: doc.consecutivo,
    tipoComprobante: doc.tipoComprobante,
    estado: doc.estado,
    fechaEmision: doc.fechaEmision,
    total: doc.totalComprobante,
    moneda: doc.moneda,
    receptor: { cedula: doc.receptorCedula, nombre: doc.receptorNombre },
  };
}

/**
 * Pone los metadatos del comprobante en encabezados X-* y envía el PDF como
 * cuerpo de la respuesta. Un mismo helper para emitir, consultar y nota de
 * crédito, para que los tres se comporten igual del lado del cliente.
 */
function enviarPdf(res, doc, buffer, extra = {}) {
  res.set('X-Documento-Id', String(doc._id));
  res.set('X-Clave', doc.clave);
  res.set('X-Consecutivo', doc.consecutivo);
  res.set('X-Tipo-Comprobante', doc.tipoComprobante);
  res.set('X-Estado', doc.estado);
  res.set('X-Total-Comprobante', String(doc.totalComprobante));
  res.set('X-Moneda', doc.moneda || 'CRC');
  if (doc.receptorCedula) res.set('X-Receptor-Cedula', doc.receptorCedula);
  if (doc.receptorNombre) res.set('X-Receptor-Nombre', encodeURIComponent(doc.receptorNombre));
  for (const [llave, valor] of Object.entries(extra)) {
    if (valor !== undefined && valor !== null) res.set(llave, String(valor));
  }

  res.type('pdf');
  res.set('Content-Disposition', `inline; filename="${doc.clave}.pdf"`);
  res.set('Cache-Control', 'private, no-store');
  res.send(buffer);
}

// -----------------------------------------------------------------------------
// POST /api/v1/documents — emitir
// -----------------------------------------------------------------------------

router.post('/', async (req, res, next) => {
  try {
    const { adaptador, plantillaId, ...cuerpo } = req.body || {};

    const doc = await emision.emitir({
      tenant: req.tenant,
      entrada: cuerpo.datos || cuerpo,   // acepta { datos: {...} } o el objeto directo
      adaptador: adaptador || req.query.adapter,
      plantillaId,
    });

    const buffer = await almacen.leerPdf(req.tenant._id, doc.clave);

    res.status(201);
    enviarPdf(res, doc, buffer);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/documents — listar
// -----------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const { desde, hasta, receptor, tipo, estado, page = 1, limit = 25 } = req.query;

    const filtro = { tenantId: req.tenant._id };
    if (receptor) filtro.receptorCedula = String(receptor).replace(/\D/g, '');
    if (tipo) filtro.tipoComprobante = tipo;
    if (estado) filtro.estado = estado;
    if (desde || hasta) {
      filtro.fechaEmision = {};
      if (desde) filtro.fechaEmision.$gte = new Date(desde);
      if (hasta) filtro.fechaEmision.$lte = new Date(hasta);
    }

    const porPagina = Math.min(Number(limit) || 25, 100);
    const saltar = (Math.max(Number(page) || 1, 1) - 1) * porPagina;

    const [docs, total] = await Promise.all([
      Document.find(filtro).sort({ fechaEmision: -1 }).skip(saltar).limit(porPagina),
      Document.countDocuments(filtro),
    ]);

    res.json({
      datos: docs.map(resumenDocumento),
      paginacion: {
        pagina: Number(page) || 1,
        porPagina,
        total,
        paginas: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/documents/:id — detalle
// -----------------------------------------------------------------------------

/** Busca por ObjectId o por clave de 50 dígitos, lo que sea más cómodo. */
async function buscarDocumento(req) {
  const { id } = req.params;
  const filtro = /^\d{50}$/.test(id)
    ? { clave: id, tenantId: req.tenant._id }
    : { _id: id, tenantId: req.tenant._id };
  return Document.findOne(filtro);
}

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await buscarDocumento(req);
    if (!doc) return res.status(404).json({ error: 'NO_ENCONTRADO' });

    res.json({
      ...resumenDocumento(doc),
      ...(req.query.incluirPayload === 'true' ? { payload: doc.payload } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/documents/:id/pdf — el PDF, directo
// -----------------------------------------------------------------------------

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const doc = await buscarDocumento(req);
    if (!doc) return res.status(404).json({ error: 'NO_ENCONTRADO' });

    // El PDF puede faltar si se cayó el almacenamiento durante la emisión.
    if (!(await almacen.existePdf(req.tenant._id, doc.clave))) {
      await emision.regenerarPdf(doc);
    }

    const buffer = await almacen.leerPdf(req.tenant._id, doc.clave);
    enviarPdf(res, doc, buffer);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/v1/documents/:id/nota-credito — anular o corregir
// -----------------------------------------------------------------------------

router.post('/:id/nota-credito', async (req, res, next) => {
  try {
    const original = await buscarDocumento(req);
    if (!original) return res.status(404).json({ error: 'NO_ENCONTRADO' });

    const { razon, codigo = '01', montoParcial } = req.body || {};

    const nc = await emision.emitirNotaCredito({
      tenant: req.tenant,
      original,
      razon,
      codigo,
      montoParcial,
    });

    const buffer = await almacen.leerPdf(req.tenant._id, nc.clave);

    res.status(201);
    enviarPdf(res, nc, buffer, {
      'X-Original-Id': String(original._id),
      'X-Original-Clave': original.clave,
      'X-Original-Estado': original.estado,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/v1/documents/preview — probar sin emitir ++
//
// No numera, no guarda y no consume secuencia. Sirve para que el cliente afine
// su integración sin ensuciar el historial ni quemar consecutivos.
// -----------------------------------------------------------------------------

router.post('/preview', async (req, res, next) => {
  try {
    const { adaptador, plantillaId, ...cuerpo } = req.body || {};
    const html = await emision.previsualizar({
      tenant: req.tenant,
      entrada: cuerpo.datos || cuerpo,
      adaptador: adaptador || req.query.adapter,
      plantillaId,
    });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

/*router.post('/preview', async (req, res, next) => {
  try {
    const { adaptador, ...cuerpo } = req.body || {};
    const html = await emision.previsualizar({
      tenant: req.tenant,
      entrada: cuerpo.datos || cuerpo,
      adaptador: adaptador || req.query.adapter,
    });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});*/

module.exports = router;
