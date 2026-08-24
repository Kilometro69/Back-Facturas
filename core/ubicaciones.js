/**
 * ubicaciones.js — Codificación territorial (Nota 14 del Anexo v4.4)
 * -----------------------------------------------------------------------------
 * El comprobante guarda códigos: provincia "1", cantón "02", distrito "03".
 * El PDF debe imprimir nombres (nota 7), así que hace falta esta traducción.
 *
 * ALCANCE: se incluyen las 7 provincias y los 82 cantones. Los distritos son
 * más de 480 y cambian con cierta frecuencia, así que NO se embeben acá: se
 * cargan desde el archivo oficial "Codificacionubicacion_V4.4" que publica
 * Hacienda, con `cargarDistritos()`. Mientras no se cargue, el renderer imprime
 * el código del distrito tal cual en vez de inventar un nombre.
 *
 * Los cantones 6-12 (Monteverde) y 6-13 (Puerto Jiménez) son recientes: se
 * segregaron de Puntarenas y Golfito en 2021 y 2022.
 * -----------------------------------------------------------------------------
 */

'use strict';

const PROVINCIAS = {
  1: 'San José',
  2: 'Alajuela',
  3: 'Cartago',
  4: 'Heredia',
  5: 'Guanacaste',
  6: 'Puntarenas',
  7: 'Limón',
};

const CANTONES = {
  1: {
    1: 'San José', 2: 'Escazú', 3: 'Desamparados', 4: 'Puriscal', 5: 'Tarrazú',
    6: 'Aserrí', 7: 'Mora', 8: 'Goicoechea', 9: 'Santa Ana', 10: 'Alajuelita',
    11: 'Vázquez de Coronado', 12: 'Acosta', 13: 'Tibás', 14: 'Moravia',
    15: 'Montes de Oca', 16: 'Turrubares', 17: 'Dota', 18: 'Curridabat',
    19: 'Pérez Zeledón', 20: 'León Cortés Castro',
  },
  2: {
    1: 'Alajuela', 2: 'San Ramón', 3: 'Grecia', 4: 'San Mateo', 5: 'Atenas',
    6: 'Naranjo', 7: 'Palmares', 8: 'Poás', 9: 'Orotina', 10: 'San Carlos',
    11: 'Zarcero', 12: 'Sarchí', 13: 'Upala', 14: 'Los Chiles', 15: 'Guatuso',
    16: 'Río Cuarto',
  },
  3: {
    1: 'Cartago', 2: 'Paraíso', 3: 'La Unión', 4: 'Jiménez', 5: 'Turrialba',
    6: 'Alvarado', 7: 'Oreamuno', 8: 'El Guarco',
  },
  4: {
    1: 'Heredia', 2: 'Barva', 3: 'Santo Domingo', 4: 'Santa Bárbara',
    5: 'San Rafael', 6: 'San Isidro', 7: 'Belén', 8: 'Flores', 9: 'San Pablo',
    10: 'Sarapiquí',
  },
  5: {
    1: 'Liberia', 2: 'Nicoya', 3: 'Santa Cruz', 4: 'Bagaces', 5: 'Carrillo',
    6: 'Cañas', 7: 'Abangares', 8: 'Tilarán', 9: 'Nandayure', 10: 'La Cruz',
    11: 'Hojancha',
  },
  6: {
    1: 'Puntarenas', 2: 'Esparza', 3: 'Buenos Aires', 4: 'Montes de Oro',
    5: 'Osa', 6: 'Quepos', 7: 'Golfito', 8: 'Coto Brus', 9: 'Parrita',
    10: 'Corredores', 11: 'Garabito', 12: 'Monteverde', 13: 'Puerto Jiménez',
  },
  7: {
    1: 'Limón', 2: 'Pococí', 3: 'Siquirres', 4: 'Talamanca', 5: 'Matina',
    6: 'Guácimo',
  },
};

/**
 * Distritos. Se llena en tiempo de ejecución desde el archivo oficial.
 * Estructura: DISTRITOS['1-1-1'] = 'Carmen'
 */
const DISTRITOS = {};

/**
 * Carga los distritos desde un objeto plano.
 * @param {object} mapa  { '1-1-1': 'Carmen', ... }
 */
function cargarDistritos(mapa) {
  Object.assign(DISTRITOS, mapa);
  return Object.keys(DISTRITOS).length;
}

const n = (v) => Number(String(v ?? '').replace(/^0+/, '') || 0);

function nombreProvincia(codigo) {
  return PROVINCIAS[n(codigo)] || null;
}

function nombreCanton(provincia, canton) {
  return CANTONES[n(provincia)]?.[n(canton)] || null;
}

function nombreDistrito(provincia, canton, distrito) {
  return DISTRITOS[`${n(provincia)}-${n(canton)}-${n(distrito)}`] || null;
}

/**
 * Resuelve los tres nombres de una ubicación.
 * Devuelve null en lo que no se pueda resolver; el renderer decide si imprime
 * el código o lo omite. Nunca inventa un nombre.
 */
function resolver(ubicacion) {
  if (!ubicacion) return {};
  const { provincia, canton, distrito } = ubicacion;
  return {
    provincia: nombreProvincia(provincia),
    canton: nombreCanton(provincia, canton),
    distrito: nombreDistrito(provincia, canton, distrito),
  };
}

/** Opciones para los selectores del panel. */
function opcionesProvincias() {
  return Object.entries(PROVINCIAS).map(([codigo, nombre]) => ({ codigo, nombre }));
}

function opcionesCantones(provincia) {
  const tabla = CANTONES[n(provincia)] || {};
  return Object.entries(tabla).map(([codigo, nombre]) => ({
    codigo: String(codigo).padStart(2, '0'),
    nombre,
  }));
}

module.exports = {
  PROVINCIAS,
  CANTONES,
  DISTRITOS,
  cargarDistritos,
  nombreProvincia,
  nombreCanton,
  nombreDistrito,
  resolver,
  opcionesProvincias,
  opcionesCantones,
};
