/**
 * adaptadores.js — Traducción del JSON del cliente al comprobante canónico
 * -----------------------------------------------------------------------------
 * Cada sistema cliente habla su propio idioma. El club manda
 * { jugador, motivo, monto }; una tienda mandaría { order_id, line_items }.
 *
 * En vez de relajar el esquema canónico para que acepte cualquier cosa (lo que
 * dejaría al validador sin nada contra qué validar), se traduce en el borde:
 *
 *     JSON del cliente -> adaptador -> canónico -> validador -> PDF
 *
 * El adaptador es configuración guardada en el tenant, no código. Agregar un
 * cliente nuevo no requiere desplegar.
 *
 * Se soporta a propósito un subconjunto mínimo de JSONPath: rutas con puntos,
 * índices y comodín en arrays. Un motor de transformaciones completo sería más
 * difícil de depurar que escribir el mapeo a mano.
 * -----------------------------------------------------------------------------
 */

'use strict';

// -----------------------------------------------------------------------------
// Lectura: "$.jugador.cedula", "$.items[0].precio", "$.items[*].nombre"
// -----------------------------------------------------------------------------

function leer(origen, expresion) {
  if (typeof expresion !== 'string' || !expresion.startsWith('$')) return undefined;

  const partes = expresion
    .slice(1)
    .replace(/\[(\d+|\*)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let actual = [origen];
  for (const parte of partes) {
    const siguiente = [];
    for (const v of actual) {
      if (v == null) continue;
      if (parte === '*') {
        if (Array.isArray(v)) siguiente.push(...v);
      } else if (/^\d+$/.test(parte)) {
        if (Array.isArray(v)) siguiente.push(v[Number(parte)]);
      } else {
        siguiente.push(v[parte]);
      }
    }
    actual = siguiente;
  }

  const limpios = actual.filter((v) => v !== undefined);
  if (limpios.length === 0) return undefined;
  return expresion.includes('[*]') ? limpios : limpios[0];
}

// -----------------------------------------------------------------------------
// Escritura: "receptor.identificacion.numero", "otrosCargos[0].montoCargo"
// -----------------------------------------------------------------------------

function escribir(destino, ruta, valor) {
  if (valor === undefined) return;

  const partes = ruta.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let actual = destino;

  for (let i = 0; i < partes.length - 1; i++) {
    const parte = partes[i];
    const siguienteEsIndice = /^\d+$/.test(partes[i + 1]);
    if (actual[parte] == null) actual[parte] = siguienteEsIndice ? [] : {};
    actual = actual[parte];
  }
  actual[partes[partes.length - 1]] = valor;
}

// -----------------------------------------------------------------------------
// Resolución de un valor del mapeo
// -----------------------------------------------------------------------------

const TRANSFORMACIONES = {
  numero:      (v) => Number(v),
  texto:       (v) => String(v),
  mayusculas:  (v) => String(v).toUpperCase(),
  soloDigitos: (v) => String(v).replace(/\D/g, ''),
  fechaIso:    (v) => new Date(v).toISOString(),
  redondear:   (v) => Math.round(Number(v)),
};

/**
 * Un valor del mapeo puede ser:
 *   "$.ruta"                          leer del origen
 *   { const: X }                      valor fijo
 *   { desde: "$.r", transformar: "…" } leer y transformar
 *   { desde: "$.r", porDefecto: X }   leer con respaldo
 *   { …, soloSi: "$.otra" }           escribir solo si esa otra ruta trae valor
 *
 * `soloSi` existe porque hay campos que no pueden ir juntos. El anexo prohíbe
 * el medio de pago cuando la condición de venta es crédito, así que un mapeo
 * que siempre escribe `medioPago` produce comprobantes inválidos. Con `soloSi`
 * el campo aparece únicamente cuando el cliente lo envía.
 */
function resolverValor(origen, spec) {
  if (typeof spec === 'string') return leer(origen, spec);
  if (spec == null || typeof spec !== 'object') return spec;

  // La condición se evalúa antes que nada: si no se cumple, no se escribe.
  if (spec.soloSi && leer(origen, spec.soloSi) === undefined) return undefined;

  if ('const' in spec) return spec.const;

  let valor = spec.desde ? leer(origen, spec.desde) : undefined;

  if (valor === undefined && 'porDefecto' in spec) valor = spec.porDefecto;
  if (valor === undefined) return undefined;

  if (spec.transformar) {
    const fn = TRANSFORMACIONES[spec.transformar];
    if (!fn) throw new Error(`Transformación desconocida: ${spec.transformar}`);
    valor = fn(valor);
  }
  if (spec.mapa && typeof spec.mapa === 'object') {
    valor = spec.mapa[valor] ?? spec.mapa['*'] ?? valor;
  }
  return valor;
}

// -----------------------------------------------------------------------------
// Aplicación del adaptador
// -----------------------------------------------------------------------------

/**
 * @param {object} entrada    JSON tal como lo manda el cliente
 * @param {object} adaptador  configuración guardada en el tenant
 * @returns {object} comprobante canónico, todavía sin validar
 */
function aplicar(entrada, adaptador) {
  if (!adaptador) return entrada; // sin adaptador, se asume que ya viene canónico

  const doc = {};

  if (adaptador.tipoComprobante) doc.tipoComprobante = adaptador.tipoComprobante;

  for (const [rutaDestino, spec] of Object.entries(adaptador.mapeo || {})) {
    escribir(doc, rutaDestino, resolverValor(entrada, spec));
  }

  // Líneas de detalle: se repite un submapeo por cada elemento de un array.
  if (adaptador.lineas) {
    const items = leer(entrada, adaptador.lineas.desde);
    const lista = Array.isArray(items) ? items : (items ? [items] : []);

    const lineas = lista.map((item, i) => {
      const linea = { numeroLinea: i + 1 };
      for (const [ruta, spec] of Object.entries(adaptador.lineas.mapeo || {})) {
        escribir(linea, ruta, resolverValor(item, spec));
      }
      return linea;
    });

    if (lineas.length) {
      doc.detalleServicio = { ...(doc.detalleServicio || {}), lineaDetalle: lineas };
    }
  }

  // Campos no fiscales: van al nodo Otros del anexo, que es de uso comercial.
  const meta = (adaptador.metadata || [])
    .map((expr) => resolverValor(entrada, expr))
    .flat()
    .filter((v) => v !== undefined && v !== null && v !== '');

  if (meta.length) {
    doc.otros = { otroTexto: meta.map(String).slice(0, 20) };
  }

  return doc;
}

/**
 * Revisa que un adaptador esté bien formado ANTES de guardarlo. Un adaptador
 * roto produce comprobantes inválidos en producción, y el error aparece lejos
 * de su causa.
 */
function validarAdaptador(adaptador) {
  const errores = [];

  if (!adaptador.nombre) errores.push('falta el nombre del adaptador');
  if (!adaptador.mapeo || Object.keys(adaptador.mapeo).length === 0) {
    errores.push('el mapeo está vacío');
  }

  // Revisa una regla del mapeo (string u objeto {desde, const, soloSi, ...}) y acumula
  // errores en vez de lanzar, para poder devolver la lista completa de una sola vez.
  const revisarSpec = (ruta, spec) => {
    if (typeof spec === 'string') {
      if (!spec.startsWith('$')) errores.push(`"${ruta}": las rutas de origen empiezan con $`);
      return;
    }
    if (spec == null || typeof spec !== 'object') return;
    if (!('const' in spec) && !spec.desde) {
      errores.push(`"${ruta}": debe tener "const" o "desde"`);
    }
    if (spec.transformar && !TRANSFORMACIONES[spec.transformar]) {
      errores.push(`"${ruta}": transformación desconocida "${spec.transformar}"`);
    }
  };

  for (const [ruta, spec] of Object.entries(adaptador.mapeo || {})) revisarSpec(ruta, spec);
  for (const [ruta, spec] of Object.entries(adaptador.lineas?.mapeo || {})) {
    revisarSpec(`lineas.${ruta}`, spec);
  }
  if (adaptador.lineas && !adaptador.lineas.desde) {
    errores.push('"lineas" requiere el campo "desde"');
  }

  return errores;
}

// -----------------------------------------------------------------------------
// El catálogo de adaptadores predefinidos vive en catalogoAdaptadores.js
// -----------------------------------------------------------------------------

const catalogo = require('./catalogoAdaptadores');

module.exports = {
  aplicar,
  validarAdaptador,
  leer,
  escribir,
  resolverValor,
  TRANSFORMACIONES,
  catalogo,
};
