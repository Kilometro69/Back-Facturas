/**
 * limitarIntentos.js — Limitador simple, en memoria, sin dependencias externas
 * -----------------------------------------------------------------------------
 * Pensado para rutas sensibles a fuerza bruta o spam (login, registro publico) donde alguien
 * podria probar contrasenas o crear cuentas en bucle. No es un rate-limiter de proposito general
 * (para eso hace falta algo mas robusto en produccion con mas de un proceso, como Redis), pero
 * corta el caso comun de un script insistiendo desde la misma IP.
 * -----------------------------------------------------------------------------
 */

'use strict';

const VENTANA_MS = 15 * 60 * 1000; // 15 minutos

const intentosPorRuta = new Map(); // "ruta:ip" -> [marcas de tiempo]

/**
 * @param {number} maxIntentos  cuantos se permiten dentro de la ventana
 */
function limitarIntentos(maxIntentos = 10) {
  return (req, res, next) => {
    const clave = `${req.baseUrl}${req.path}:${req.ip || 'desconocida'}`;
    const ahora = Date.now();

    const marcas = (intentosPorRuta.get(clave) || []).filter((t) => ahora - t < VENTANA_MS);

    if (marcas.length >= maxIntentos) {
      return res.status(429).json({
        error: 'DEMASIADOS_INTENTOS',
        mensaje: 'Demasiados intentos. Espere unos minutos antes de volver a intentar.',
      });
    }

    marcas.push(ahora);
    intentosPorRuta.set(clave, marcas);
    next();
  };
}

module.exports = { limitarIntentos };
