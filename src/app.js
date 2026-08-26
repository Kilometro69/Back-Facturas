/**
 * app.js — Aplicación Express
 * -----------------------------------------------------------------------------
 * Dos superficies separadas:
 *   /api/v1/*    sistemas cliente, autenticados con API key
 *   /panel/*     usuarios del panel, autenticados con JWT
 *
 * Versionada desde el día uno. Cuando cambie el contrato, /api/v2 convive con
 * /api/v1 mientras los clientes migran; si no, cada cambio rompe integraciones
 * ajenas que no controlamos.
 * -----------------------------------------------------------------------------
 */

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const documentsRouter = require('./routes/documents');
const panelRouter = require('./routes/panel');
const almacen = require('./storage/almacen');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by'); // oculta "X-Powered-By: Express" (revela el framework sin necesidad)
app.use(express.json({ limit: '2mb' }));

// -----------------------------------------------------------------------------
// CORS
//
// El panel corre en otro origen durante el desarrollo (Vite en :5173). La API
// con llave se consume desde servidores, no desde navegadores, así que no
// necesita CORS abierto.
// -----------------------------------------------------------------------------

const ORIGENES = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map((o) => o.trim());

app.use((req, res, next) => {
  const origen = req.get('origin');
  if (origen && ORIGENES.includes(origen)) {
    res.set('Access-Control-Allow-Origin', origen);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Encabezados de seguridad básicos, sin dependencias extra.
//
// La CSP no puede ser tan estricta como en una API JSON pura: /preview devuelve HTML real, con
// estilos inline (así arma el diseño el editor) e imágenes externas (el logo del tenant puede
// vivir en cualquier URL). Se permite exactamente eso y nada de scripts, ya que la vista previa
// nunca necesita ejecutar JavaScript.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src * data:; style-src 'unsafe-inline'; script-src 'none'; " +
    "frame-ancestors 'self'; base-uri 'none'; form-action 'none'"
  );
  res.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  // El filtro heredado X-XSS-Protection quedo obsoleto y removido de los navegadores modernos;
  // activarlo en navegadores viejos a veces introducia sus propios bypasses. "0" (desactivado)
  // es la recomendacion actual de OWASP, no una omision.
  res.set('X-XSS-Protection', '0');
  next();
});

// -----------------------------------------------------------------------------
// Rutas
// -----------------------------------------------------------------------------

app.get('/salud', (req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
    almacenamiento: almacen.backend,
    version: 'v1',
  });
});

app.use('/api/v1/documents', documentsRouter);
app.use('/panel', panelRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'RUTA_NO_ENCONTRADA', ruta: req.path });
});

// -----------------------------------------------------------------------------
// Manejo de errores
//
// Los errores de validación devuelven la lista COMPLETA con la nota del anexo
// referenciada. Devolver solo el primero obligaría al cliente a corregir de a
// un campo por intento.
// -----------------------------------------------------------------------------

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.name === 'ErrorValidacion') {
    return res.status(422).json({
      error: err.codigo,
      mensaje: err.mensaje || err.message,
      cantidadErrores: err.errores.length,
      detalles: err.errores,
      documentacion: 'https://atv.hacienda.go.cr/ATV/ComprobanteElectronico/docs/esquemas/2024/v4.4/',
    });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      error: err.codigo || 'SOLICITUD_INVALIDA',
      mensaje: err.message,
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'DATOS_INVALIDOS',
      detalles: Object.entries(err.errors).map(([campo, e]) => ({ campo, mensaje: e.message })),
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'DUPLICADO',
      mensaje: 'Ya existe un registro con esos datos',
      campo: Object.keys(err.keyPattern || {})[0],
    });
  }

  // Errores no previstos: se registran completos del lado del servidor y se
  // devuelve un identificador. Nunca se filtra el stack al cliente.
  const id = Math.random().toString(36).slice(2, 10);
  console.error(`[${id}]`, err);

  res.status(500).json({
    error: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado',
    referencia: id,
  });
});

module.exports = app;
