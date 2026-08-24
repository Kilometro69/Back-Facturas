/**
 * validador.js
 * -----------------------------------------------------------------------------
 * Motor genérico de validación. NO contiene reglas de negocio codificadas: todo
 * sale de fieldRules.js y catalogos.js. Un `if` por tipo de comprobante aquí
 * sería una señal de que algo debería estar en la matriz.
 *
 * Devuelve SIEMPRE la lista completa de errores, nunca aborta en el primero.
 * -----------------------------------------------------------------------------
 */

'use strict';

const { CAMPOS, TIPOS_COMPROBANTE, CONDICION } = require('./fieldRules');
const cat = require('./catalogos');

const RE_EMAIL = /^[^\s<>()[\],;:@"]+(\.[^\s<>()[\],;:@"]+)*@([^\s<>()[\],;:@"]+\.)+[^\s<>()[\],;:@"]{2,}$/;
const RE_SOLO_DIGITOS = /^\d+$/;

// -----------------------------------------------------------------------------
// Acceso por ruta, con soporte de arrays: "a.b[].c"
// -----------------------------------------------------------------------------

/**
 * Resuelve una ruta a una lista de { valor, rutaConcreta }.
 * Un solo path con [] puede resolver a N valores (uno por elemento del array).
 */
function resolver(obj, path) {
  const partes = path.split('.');
  let actuales = [{ valor: obj, ruta: '' }];

  for (const parte of partes) {
    const esArray = parte.endsWith('[]');
    const llave = esArray ? parte.slice(0, -2) : parte;
    const siguientes = [];

    for (const { valor, ruta } of actuales) {
      if (valor == null || typeof valor !== 'object') continue;
      const hijo = valor[llave];
      const rutaHijo = ruta ? `${ruta}.${llave}` : llave;

      if (esArray) {
        if (!Array.isArray(hijo)) {
          if (hijo !== undefined) siguientes.push({ valor: hijo, ruta: rutaHijo, noEsArray: true });
          continue;
        }
        hijo.forEach((el, i) => siguientes.push({ valor: el, ruta: `${rutaHijo}[${i}]` }));
      } else {
        siguientes.push({ valor: hijo, ruta: rutaHijo });
      }
    }
    actuales = siguientes;
  }
  return actuales;
}

/**
 * Un valor "vacío" no cuenta como presente. Los arrays vacíos entran acá a
 * propósito: `totalDesgloseImpuesto: []` no es un nodo presente sin hijos, es
 * un nodo que no aplica. Sin esto, el validador exige los campos de un nodo
 * que en realidad no existe.
 */
const vacio = (v) =>
  v === undefined
  || v === null
  || (typeof v === 'string' && v.trim() === '')
  || (Array.isArray(v) && v.length === 0);

// -----------------------------------------------------------------------------
// Jerarquía de nodos
//
// En el anexo, la condición de un campo se interpreta DENTRO de su nodo padre.
// "CodigoPais = 1" no significa que todo comprobante lleve código de país:
// significa que si se incluye el nodo Telefono (opcional), entonces el código
// de país es obligatorio dentro de él. Sin esto, el validador exige medio anexo.
// -----------------------------------------------------------------------------

const COMPLEJOS = CAMPOS.filter((c) => c.tipo === 'complex').map((c) => c.path);

/** ¿Es `padre` un nodo ancestro de `hijo`? Tolera el sufijo [] de arrays. */
function esAncestro(padre, hijo) {
  return hijo.startsWith(`${padre}.`) || hijo.startsWith(`${padre}[].`);
}

/** Ancestros complejos de un campo, del más cercano al más lejano. */
const CACHE_PADRES = new Map();
function padresDe(path) {
  if (CACHE_PADRES.has(path)) return CACHE_PADRES.get(path);
  const padres = COMPLEJOS
    .filter((p) => esAncestro(p, path))
    .sort((a, b) => b.length - a.length);
  CACHE_PADRES.set(path, padres);
  return padres;
}

/** true si algún nodo padre está ausente: el hijo no se evalúa. */
function padreAusente(doc, path) {
  for (const padre of padresDe(path)) {
    const instancias = resolver(doc, padre);
    if (instancias.length === 0 || instancias.every(({ valor }) => vacio(valor))) return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Validaciones de formato
// -----------------------------------------------------------------------------

const REGLAS_FORMATO = {
  numerico(valor) {
    return RE_SOLO_DIGITOS.test(String(valor)) ? null : 'debe contener solo dígitos';
  },
  email(valor) {
    return RE_EMAIL.test(String(valor)) ? null : 'formato de correo inválido';
  },
  mayorACero(valor) {
    return Number(valor) > 0 ? null : 'debe ser mayor a cero';
  },
  /** Formato de cédula según nota 4 del anexo. */
  cedula(valor, ctx) {
    const n = String(valor);
    const tipo = ctx.tipoIdentificacion;
    if (tipo === '05' || tipo === '06') {
      return n.length <= 20 ? null : 'máximo 20 caracteres';
    }
    if (!RE_SOLO_DIGITOS.test(n)) return 'sin guiones ni espacios, solo dígitos';
    switch (tipo) {
      case '01':
        return n.length === 9 && !n.startsWith('0')
          ? null : 'cédula física: 9 dígitos, sin cero inicial ni guiones';
      case '02':
        return n.length === 10 ? null : 'cédula jurídica: 10 dígitos sin guiones';
      case '03':
        return (n.length === 11 || n.length === 12) && !n.startsWith('0')
          ? null : 'DIMEX: 11 o 12 dígitos, sin ceros iniciales';
      case '04':
        return n.length === 10 ? null : 'NITE: 10 dígitos sin guiones';
      default:
        return null;
    }
  },
};

/** Valida largo y precisión decimal. `max` puede ser 50 o "18,5". */
function validarTamano(campo, valor) {
  const errores = [];

  if (campo.tipo === 'decimal' && typeof campo.max === 'string') {
    const [ent, dec] = campo.max.split(',').map(Number);
    const [pe, pd = ''] = String(Math.abs(Number(valor))).split('.');
    if (pe.length > ent) errores.push(`máximo ${ent} dígitos enteros`);
    if (pd.length > dec) errores.push(`máximo ${dec} decimales`);
    return errores;
  }

  const largo = String(valor).length;
  if (typeof campo.max === 'number' && largo > campo.max) {
    errores.push(`largo máximo ${campo.max}, recibido ${largo}`);
  }
  if (typeof campo.min === 'number' && largo < campo.min) {
    errores.push(`largo mínimo ${campo.min}, recibido ${largo}`);
  }
  return errores;
}

// validarTipo: revisa que el valor tenga la forma correcta para el "tipo" declarado en
// fieldRules.js (entero, decimal, string, fecha, etc). Devuelve el mensaje de error, o null si
// el valor es válido.
function validarTipo(campo, valor) {
  switch (campo.tipo) {
    case 'integer':
    case 'positiveInteger': {
      if (!Number.isInteger(Number(valor))) return 'debe ser un número entero';
      if (campo.tipo === 'positiveInteger' && Number(valor) <= 0) return 'debe ser un entero positivo';
      return null;
    }
    case 'decimal':
      return Number.isFinite(Number(valor)) ? null : 'debe ser un número decimal';
    case 'dateTime':
      return Number.isNaN(Date.parse(valor)) ? null : null; // formato laxo; ver nota abajo
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Validador principal
// -----------------------------------------------------------------------------

/**
 * @param {object} doc            comprobante canónico
 * @param {string} tipoComprobante FE | FEE | FEC | TE | NC | ND | REP
 * @returns {{ valido: boolean, errores: Array }}
 */
function validar(doc, tipoComprobante) {
  const errores = [];

  if (!TIPOS_COMPROBANTE.includes(tipoComprobante)) {
    return {
      valido: false,
      errores: [{
        campo: 'tipoComprobante',
        regla: 'catalogo',
        mensaje: 'tipo de comprobante no reconocido',
        validos: TIPOS_COMPROBANTE,
      }],
    };
  }

  const idx = TIPOS_COMPROBANTE.indexOf(tipoComprobante);
  const ctxGlobal = {
    condicionVenta: doc.condicionVenta,
    tipoIdentificacionEmisor: doc?.emisor?.identificacion?.tipo,
    tipoIdentificacionReceptor: doc?.receptor?.identificacion?.tipo,
  };

  for (const campo of CAMPOS) {
    const condicion = Number(campo.cond[idx]);
    const instancias = resolver(doc, campo.path);

    // El nodo contenedor no vino: sus hijos no aplican. Si ese nodo era
    // obligatorio, el error se reporta una sola vez a nivel del nodo.
    if (padreAusente(doc, campo.path)) continue;

    // --- INEXISTENTE: no debe venir ------------------------------------------
    if (condicion === CONDICION.INEXISTENTE) {
      for (const { valor, ruta } of instancias) {
        if (!vacio(valor)) {
          errores.push({
            campo: ruta,
            regla: 'inexistente',
            mensaje: `no debe usarse en comprobante tipo ${tipoComprobante}`,
          });
        }
      }
      continue;
    }

    // --- OBLIGATORIO: debe venir ---------------------------------------------
    if (condicion === CONDICION.OBLIGATORIO) {
      if (instancias.length === 0 || instancias.every(({ valor }) => vacio(valor))) {
        errores.push({
          campo: campo.path,
          regla: 'obligatorio',
          mensaje: `requerido en comprobante tipo ${tipoComprobante}`,
          ...(campo.ayuda ? { ayuda: campo.ayuda } : {}),
        });
        continue;
      }
    }

    // --- CONDICIONAL con dependencia declarada -------------------------------
    if (condicion === CONDICION.CONDICIONAL && campo.requeridoSi) {
      const { campo: dep, valor: v, valorEn } = campo.requeridoSi;
      const valorDep = ctxGlobal[dep] ?? doc[dep];
      const dispara = valorEn ? valorEn.includes(valorDep) : valorDep === v;
      if (dispara && instancias.every(({ valor }) => vacio(valor))) {
        errores.push({
          campo: campo.path,
          regla: 'condicional',
          mensaje: `requerido cuando ${dep} = ${valorDep}`,
        });
      }
    }

    // --- Validaciones sobre los valores presentes ----------------------------
    for (const { valor, ruta } of instancias) {
      if (vacio(valor)) continue;

      const errTipo = validarTipo(campo, valor);
      if (errTipo) {
        errores.push({ campo: ruta, regla: 'tipo', mensaje: errTipo, recibido: valor });
        continue;
      }

      for (const msg of validarTamano(campo, valor)) {
        errores.push({ campo: ruta, regla: 'tamano', mensaje: msg, recibido: valor });
      }

      if (campo.regla && REGLAS_FORMATO[campo.regla]) {
        const ctx = {
          ...ctxGlobal,
          tipoIdentificacion: ruta.startsWith('emisor')
            ? ctxGlobal.tipoIdentificacionEmisor
            : ctxGlobal.tipoIdentificacionReceptor,
        };
        const msg = REGLAS_FORMATO[campo.regla](valor, ctx);
        if (msg) errores.push({ campo: ruta, regla: campo.regla, mensaje: msg, recibido: valor });
      }

      const nota = campo.nota ?? (campo.notas && campo.notas[0]);
      if (nota && !cat.esCodigoValido(nota, String(valor))) {
        errores.push({
          campo: ruta,
          regla: 'catalogo',
          nota,
          mensaje: `código no existe en el catálogo de la nota ${nota}`,
          recibido: valor,
          validos: cat.opciones(nota).map((o) => o.codigo),
        });
      }
    }
  }

  errores.push(...reglasCruzadas(doc, tipoComprobante));

  return { valido: errores.length === 0, errores };
}

// -----------------------------------------------------------------------------
// Reglas que involucran más de un campo. Estas sí viven en código porque son
// relaciones, no propiedades de un campo individual.
//
// IMPORTANTE: acá NO se verifica aritmética. La plataforma no comprueba que el
// total coincida con la suma de las líneas, ni que el subtotal descuente bien.
// Esos montos los envía el cliente ya calculados según las reglas de su
// negocio, y son su responsabilidad. Lo que sí se revisa son relaciones
// estructurales que define el anexo y que no dependen del negocio del cliente.
// -----------------------------------------------------------------------------

function reglasCruzadas(doc, tipo) {
  const e = [];
  const r = doc.resumen || {};

  // Moneda CRC obliga tipo de cambio exactamente 1
  const moneda = r.codigoTipoMoneda || {};
  if (moneda.codigoMoneda === 'CRC' && Number(moneda.tipoCambio) !== 1) {
    e.push({
      campo: 'resumen.codigoTipoMoneda.tipoCambio',
      regla: 'estructura',
      mensaje: 'con moneda CRC el tipo de cambio debe ser 1',
      recibido: moneda.tipoCambio,
    });
  }

  // Crédito no lleva medio de pago; contado sí lo exige
  const esCredito = cat.CONDICIONES_CREDITO.includes(doc.condicionVenta);
  const tieneMedioPago = Array.isArray(r.medioPago) && r.medioPago.length > 0;
  if (esCredito && tieneMedioPago) {
    e.push({
      campo: 'resumen.medioPago',
      regla: 'condicional',
      mensaje: `no debe incluirse cuando la condición de venta es crédito (${doc.condicionVenta})`,
    });
  }
  if (!esCredito && !tieneMedioPago && tipo !== 'REP') {
    e.push({
      campo: 'resumen.medioPago',
      regla: 'condicional',
      mensaje: 'requerido cuando la condición de venta no es crédito',
    });
  }

  // Plazo de crédito debe ser mayor a cero
  if (['02', '10'].includes(doc.condicionVenta) && !(Number(doc.plazoCredito) > 0)) {
    e.push({
      campo: 'plazoCredito',
      regla: 'estructura',
      mensaje: 'en condición crédito el plazo debe ser mayor a cero',
      recibido: doc.plazoCredito,
    });
  }

  // Excepción de la nota 16: sin líneas de detalle solo si otros cargos lo permite
  const sinDetalle = !doc.detalleServicio?.lineaDetalle?.length;
  if (sinDetalle && ['FE', 'TE', 'NC', 'ND'].includes(tipo)) {
    const cargos = doc.otrosCargos || [];
    const habilitado = cargos.length > 0
      && cargos.every((c) => cat.OTROS_CARGOS_SIN_DETALLE.includes(c.tipoDocumentoOc));
    if (!habilitado) {
      e.push({
        campo: 'detalleServicio.lineaDetalle',
        regla: 'condicional',
        nota: 16,
        mensaje: 'sin líneas de detalle solo se permite con otros cargos tipo 04, 08, 09 o 10',
      });
    }
  }

  return e;
}

module.exports = { validar, resolver, REGLAS_FORMATO };
