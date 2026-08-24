/**
 * identificadores.js
 * -----------------------------------------------------------------------------
 * Generación de la clave numérica (50 dígitos) y la numeración consecutiva
 * (20 dígitos), según la Nota 3 del Anexo v4.4.
 *
 * Estos dos strings son la identidad del comprobante. Un error acá no lanza
 * excepción: produce un documento silenciosamente inválido. Por eso todo se
 * valida en la construcción y se verifica el largo al final.
 * -----------------------------------------------------------------------------
 */

'use strict';

const { CODIGO_TIPO_COMPROBANTE, SITUACION_COMPROBANTE } = require('./catalogos');

// -----------------------------------------------------------------------------
// Numeración consecutiva — 20 dígitos
//   1-3    local o establecimiento (001 = casa matriz)
//   4-8    terminal o punto de venta (00001 si hay servidor centralizado)
//   9-10   tipo de comprobante (nota 3)
//   11-20  secuencia, arranca en 1
// -----------------------------------------------------------------------------

function generarConsecutivo({ local = 1, terminal = 1, tipoComprobante, secuencia }) {
  const codigo = CODIGO_TIPO_COMPROBANTE[tipoComprobante];
  if (!codigo) throw new Error(`Tipo de comprobante inválido: ${tipoComprobante}`);
  if (!Number.isInteger(secuencia) || secuencia < 1) {
    throw new Error('La secuencia debe ser un entero mayor o igual a 1');
  }
  if (local < 1 || local > 999) throw new Error('Local fuera de rango (001-999)');
  if (terminal < 1 || terminal > 99999) throw new Error('Terminal fuera de rango (00001-99999)');
  if (secuencia > 9999999999) {
    // El anexo permite reiniciar en 1 al agotar la numeración.
    throw new Error('Secuencia agotada: reiniciar el contador en 1');
  }

  const consecutivo =
    String(local).padStart(3, '0') +
    String(terminal).padStart(5, '0') +
    codigo +
    String(secuencia).padStart(10, '0');

  if (consecutivo.length !== 20) {
    throw new Error(`Consecutivo con largo inválido: ${consecutivo.length}`);
  }
  return consecutivo;
}

/** Descompone un consecutivo existente. Útil para el historial y depuración. */
function parsearConsecutivo(consecutivo) {
  if (!/^\d{20}$/.test(consecutivo)) throw new Error('Consecutivo inválido');
  const codigo = consecutivo.slice(8, 10);
  const tipo = Object.keys(CODIGO_TIPO_COMPROBANTE)
    .find((k) => CODIGO_TIPO_COMPROBANTE[k] === codigo);
  return {
    local: Number(consecutivo.slice(0, 3)),
    terminal: Number(consecutivo.slice(3, 8)),
    codigoTipo: codigo,
    tipoComprobante: tipo || null,
    secuencia: Number(consecutivo.slice(10, 20)),
  };
}

// -----------------------------------------------------------------------------
// Cédula a 12 posiciones — Nota 4.1
//   Física   9 dígitos  + 3 ceros al inicio
//   Jurídica 10 dígitos + 2 ceros
//   DIMEX    11 o 12; si son 11 se antepone 1 cero
//   NITE     10 dígitos + 2 ceros
// -----------------------------------------------------------------------------

function normalizarCedulaParaClave(numero, tipoIdentificacion) {
  const n = String(numero).replace(/[\s-]/g, '');

  if (tipoIdentificacion === '05' || tipoIdentificacion === '06') {
    // La nota 4.1 no define relleno para "Extranjero No Domiciliado" ni "No
    // Contribuyente" porque solo aparecen como emisor en la FEC, donde quien
    // firma y numera es el receptor nacional. Si llega acá, es un error de flujo.
    throw new Error(
      `El tipo de identificación ${tipoIdentificacion} no puede usarse para generar la clave. ` +
      'En Factura Electrónica de Compra la clave se genera con la cédula del receptor nacional.'
    );
  }

  if (!/^\d+$/.test(n)) throw new Error(`Cédula con caracteres no numéricos: ${numero}`);
  if (n.length > 12) throw new Error(`Cédula demasiado larga para la clave: ${n.length} dígitos`);

  return n.padStart(12, '0');
}

// -----------------------------------------------------------------------------
// Clave numérica — 50 dígitos
//   1-3    código de país (506)
//   4-5    día
//   6-7    mes
//   8-9    año (2 dígitos)
//   10-21  cédula del emisor (12, con relleno de la nota 4.1)
//   22-41  consecutivo (20)
//   42     situación (1 normal, 2 contingencia, 3 sin internet)
//   43-50  código de seguridad (8 dígitos, lo genera el sistema del emisor)
// -----------------------------------------------------------------------------

const CODIGO_PAIS = '506';

/** Código de seguridad de 8 dígitos. Usa CSPRNG, no Math.random. */
function generarCodigoSeguridad() {
  const { randomInt } = require('crypto');
  return String(randomInt(0, 100000000)).padStart(8, '0');
}

// generarClave: arma la clave numérica de 50 dígitos que exige la nota 3 del anexo (país, fecha,
// cédula del emisor, consecutivo, situación y código de seguridad, todo concatenado sin separadores).
function generarClave({
  fechaEmision,
  cedulaEmisor,
  tipoIdentificacionEmisor,
  consecutivo,
  situacion = 1,
  codigoSeguridad,
}) {
  const fecha = fechaEmision instanceof Date ? fechaEmision : new Date(fechaEmision);
  if (Number.isNaN(fecha.getTime())) throw new Error('Fecha de emisión inválida');

  if (!/^\d{20}$/.test(consecutivo)) {
    throw new Error('El consecutivo debe tener exactamente 20 dígitos');
  }
  if (!SITUACION_COMPROBANTE[situacion]) {
    throw new Error(`Situación inválida: ${situacion}. Válidas: 1, 2, 3`);
  }

  const seguridad = codigoSeguridad ?? generarCodigoSeguridad();
  if (!/^\d{8}$/.test(seguridad)) {
    throw new Error('El código de seguridad debe tener 8 dígitos');
  }

  // La fecha de la clave debe coincidir con FechaEmision del comprobante.
  // Se usa hora local de Costa Rica (UTC-6), no UTC, para no correr el día.
  const cr = new Date(fecha.getTime() - 6 * 60 * 60 * 1000);
  const dd = String(cr.getUTCDate()).padStart(2, '0');
  const mm = String(cr.getUTCMonth() + 1).padStart(2, '0');
  const aa = String(cr.getUTCFullYear()).slice(-2);

  const cedula = normalizarCedulaParaClave(cedulaEmisor, tipoIdentificacionEmisor);

  const clave = CODIGO_PAIS + dd + mm + aa + cedula + consecutivo + String(situacion) + seguridad;

  if (clave.length !== 50) throw new Error(`Clave con largo inválido: ${clave.length}`);
  return clave;
}

/** Descompone una clave. Sirve para el historial y para verificar coherencia. */
function parsearClave(clave) {
  if (!/^\d{50}$/.test(clave)) throw new Error('Clave inválida: deben ser 50 dígitos');
  return {
    pais: clave.slice(0, 3),
    dia: clave.slice(3, 5),
    mes: clave.slice(5, 7),
    anio: clave.slice(7, 9),
    cedulaEmisor: clave.slice(9, 21),
    consecutivo: clave.slice(21, 41),
    situacion: Number(clave.slice(41, 42)),
    codigoSeguridad: clave.slice(42, 50),
  };
}

/** La clave debe contener el mismo consecutivo y la misma fecha del comprobante. */
function verificarCoherencia(clave, consecutivo, fechaEmision) {
  const p = parsearClave(clave);
  const errores = [];

  if (p.consecutivo !== consecutivo) {
    errores.push('el consecutivo dentro de la clave no coincide con NumeroConsecutivo');
  }
  const cr = new Date(new Date(fechaEmision).getTime() - 6 * 60 * 60 * 1000);
  const esperado =
    String(cr.getUTCDate()).padStart(2, '0') +
    String(cr.getUTCMonth() + 1).padStart(2, '0') +
    String(cr.getUTCFullYear()).slice(-2);
  if (p.dia + p.mes + p.anio !== esperado) {
    errores.push('la fecha dentro de la clave no coincide con FechaEmision');
  }
  return errores;
}

// -----------------------------------------------------------------------------
// Nombres de archivo normados por la nota 3
// -----------------------------------------------------------------------------

const nombreArchivo = {
  pdf: (clave) => `${clave}.pdf`,
  xml: (clave) => `${clave}.xml`,
  respuesta: (clave) => `${clave}_respuesta.xml`,
  confirmacionPdf: (clave, consec) => `${clave}-${consec}.pdf`,
};

module.exports = {
  generarConsecutivo,
  parsearConsecutivo,
  generarClave,
  parsearClave,
  verificarCoherencia,
  generarCodigoSeguridad,
  normalizarCedulaParaClave,
  nombreArchivo,
  CODIGO_PAIS,
};
