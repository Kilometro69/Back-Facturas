/**
 * server.js — Punto de entrada
 */

'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const { cerrar: cerrarPdf } = require('./render/pdf');

const PUERTO = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/facturacion';

// iniciar: conecta Mongo y arranca el servidor HTTP. Se separa de la ejecución directa (ver el
// llamado al final del archivo) para poder capturar el error de conexión con un mensaje claro.
async function iniciar() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB conectado');

  const servidor = app.listen(PUERTO, () => {
    console.log(`API escuchando en http://localhost:${PUERTO}`);
  });

  // Apagado ordenado: se dejan terminar las peticiones en curso antes de
  // cerrar Chromium y la conexión a Mongo. Matar el proceso de golpe puede
  // dejar un comprobante numerado sin PDF.
  const apagar = async (senal) => {
    console.log(`\n${senal} recibido, cerrando...`);
    servidor.close(async () => {
      await cerrarPdf();
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));
}

iniciar().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
