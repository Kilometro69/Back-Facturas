/**
 * redondeo.js — Redondeo y formato numérico del Anexo v4.4
 * -----------------------------------------------------------------------------
 * Este módulo NO calcula montos. La plataforma no deriva totales, subtotales,
 * impuestos ni descuentos: esos son datos del negocio del cliente, que los
 * envía completos. Nosotros los recibimos, los validamos contra la estructura
 * del anexo y los imprimimos.
 *
 * Lo que sí necesitamos es normalizar la representación numérica, porque el
 * anexo fija el método de redondeo y el PDF debe imprimir montos consistentes.
 * -----------------------------------------------------------------------------
 */

'use strict';

// -----------------------------------------------------------------------------
// Redondeo
//
// El anexo define el método así:
//   "Cuando el dígito es menor que 5 y el siguiente decimal es menor que 5, el
//    anterior no se modifica.  20.203512 -> 20.20351
//    Cuando el dígito es mayor o igual que 5 y el siguiente decimal es mayor o
//    igual que 5, el anterior se incrementa en una unidad.  20.203518 -> 20.20352"
//
// La redacción solo cubre dos de los cuatro casos posibles y es ambigua. En la
// práctica ambos ejemplos son consistentes con redondeo half-up sobre el primer
// decimal excedente, que es lo que implementamos.
//
// No se usa toFixed(): opera en punto flotante binario y produce resultados
// incorrectos en casos comunes (1.005.toFixed(2) === "1.00"). Se redondea sobre
// la representación decimal.
// -----------------------------------------------------------------------------

const DECIMALES = 5;

function redondear(valor, decimales = DECIMALES) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  if (n === 0) return 0;

  const signo = n < 0 ? -1 : 1;
  const abs = Math.abs(n);

  // Notación exponencial para desplazar el punto sin error binario
  const desplazado = Number(`${abs}e${decimales}`);
  const redondeado = Math.round(desplazado);
  const corregido = Math.abs(desplazado - Math.trunc(desplazado) - 0.5) < Number.EPSILON
    ? Math.trunc(desplazado) + 1 // half-up explícito
    : redondeado;

  return signo * Number(`${corregido}e-${decimales}`);
}

/** Redondeo a 2 decimales para lo que se imprime en el PDF. */
const redondearMoneda = (v) => redondear(v, 2);

// -----------------------------------------------------------------------------
// Clasificación por CAByS
//   Primer dígito 0-4 => mercancía
//   Primer dígito 5-9 => servicio
//
// Se usa solo para decidir cómo agrupar en la representación gráfica; los
// totales por categoría los envía el cliente.
// -----------------------------------------------------------------------------

function esServicio(codigoCabys) {
  const d = String(codigoCabys || '').charAt(0);
  return ['5', '6', '7', '8', '9'].includes(d);
}

module.exports = { redondear, redondearMoneda, esServicio, DECIMALES };
