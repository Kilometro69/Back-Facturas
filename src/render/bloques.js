/**
 * bloques.js — Catálogo de bloques del comprobante
 * -----------------------------------------------------------------------------
 * Cada bloque es una función pura: (documento, contexto) -> HTML.
 *
 * El tenant reordena, oculta y configura bloques desde el editor, pero no puede
 * inventar bloques nuevos ni partirlos. Dos restricciones vienen del anexo y no
 * son negociables:
 *
 *   - `identificacion` es ATÓMICO. La nota 1 exige que tipo de documento, clave
 *     y consecutivo queden juntos en la representación gráfica. Por eso los tres
 *     campos viven en un solo bloque que no se puede ocultar ni dividir.
 *
 *   - Todo código se imprime como DESCRIPCIÓN, nunca como número (nota 7).
 *     De eso se encarga `d()`, que envuelve a catalogos.describir().
 * -----------------------------------------------------------------------------
 */

'use strict';

const cat = require('../../core/catalogos');
const { redondearMoneda } = require('../../core/redondeo');

// -----------------------------------------------------------------------------
// Utilidades de formato
// -----------------------------------------------------------------------------

/** Escapa HTML. Los datos vienen de terceros vía API: nunca se confían. */
function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Descripción de un código según su nota. Nota 7 del anexo. */
const d = (nota, codigo) => esc(cat.describir(nota, codigo));

/**
 * Monto con separador de miles y 2 decimales.
 *
 * No se usa Intl.NumberFormat con 'es-CR': ICU devuelve un espacio estrecho
 * de no separación (U+202F) como separador de miles, que en el PDF se ve como
 * un hueco raro y además varía según cómo esté compilado Node. Se formatea a
 * mano para tener el mismo resultado en toda máquina.
 */
function monto(valor, moneda = 'CRC', formato = {}) {
  const { miles = '.', decimal = ',' } = formato;
  const n = redondearMoneda(Number(valor || 0));

  const negativo = n < 0;
  const [entero, dec = '00'] = Math.abs(n).toFixed(2).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, miles);

  const simbolo = { CRC: '₡', USD: '$', EUR: '€' }[moneda] || `${moneda} `;
  return `${negativo ? '-' : ''}${simbolo}${conMiles}${decimal}${dec}`;
}

function fecha(valor) {
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return '';
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Costa_Rica',
  }).format(f);
}

/** Clave de 50 dígitos partida en grupos, para que sea legible en papel. */
function claveLegible(clave) {
  return String(clave || '').replace(/(.{10})/g, '$1 ').trim();
}

/** Ubicación como texto. Requiere el catálogo de la nota 14 ya resuelto. */
function ubicacionTexto(u, nombres = {}) {
  if (!u) return '';
  return [nombres.distrito, nombres.canton, nombres.provincia, u.barrio, u.otrasSenas]
    .filter(Boolean).map(esc).join(', ');
}

const fila = (etiqueta, valor) =>
  valor ? `<tr><th>${esc(etiqueta)}</th><td>${valor}</td></tr>` : '';

// -----------------------------------------------------------------------------
// Bloques
// -----------------------------------------------------------------------------

const BLOQUES = {

  /** Logo y datos del emisor. */
  encabezado(doc, ctx) {
    const e = doc.emisor || {};
    const logo = ctx.branding.logoUrl
      ? `<img class="logo" src="${esc(ctx.branding.logoUrl)}" alt="">`
      : '';
    const contacto = [
      e.telefono?.numTelefono ? `Tel. ${esc(e.telefono.numTelefono)}` : '',
      [].concat(e.correoElectronico || []).filter(Boolean).map(esc).join(' · '),
    ].filter(Boolean).join(' · ');

    return `
<section class="bloque encabezado">
  ${logo}
  <div class="emisor">
    <h1>${esc(e.nombreComercial || e.nombre)}</h1>
    ${e.nombreComercial ? `<div class="razon">${esc(e.nombre)}</div>` : ''}
    <div class="linea">${d(4, e.identificacion?.tipo)} ${esc(e.identificacion?.numero)}</div>
    <div class="linea">${ubicacionTexto(e.ubicacion, ctx.nombresUbicacionEmisor)}</div>
    ${contacto ? `<div class="linea">${contacto}</div>` : ''}
  </div>
</section>`;
  },

  /**
   * Tipo de documento, clave y consecutivo. ATÓMICO por la nota 1.
   * No aparece en el editor como campos separados a propósito.
   */
  identificacion(doc, ctx) {
    const qr = ctx.mostrarQr && ctx.qrDataUri
      ? `<img class="qr" src="${esc(ctx.qrDataUri)}" alt="">`
      : '';
    return `
<section class="bloque identificacion" data-atomico="true">
  <div class="datos">
    <div class="tipo-documento">${esc(ctx.nombreTipoComprobante)}</div>
    <table class="kv">
      ${fila('Clave', `<span class="clave">${esc(claveLegible(doc.clave))}</span>`)}
      ${fila('Consecutivo', esc(doc.numeroConsecutivo))}
      ${fila('Fecha de emisión', esc(fecha(doc.fechaEmision)))}
    </table>
  </div>
  ${qr}
</section>`;
  },

  /** Datos del receptor. */
  receptor(doc, ctx) {
    const r = doc.receptor;
    if (!r) return '';
    return `
<section class="bloque receptor">
  <h2>Receptor</h2>
  <table class="kv">
    ${fila('Nombre', esc(r.nombre))}
    ${fila('Identificación', `${d(4, r.identificacion?.tipo)} ${esc(r.identificacion?.numero)}`)}
    ${fila('Correo', esc(r.correoElectronico))}
    ${fila('Dirección', ubicacionTexto(r.ubicacion, ctx.nombresUbicacionReceptor))}
  </table>
</section>`;
  },

  /** Condición de venta, plazo y medios de pago. */
  condiciones(doc) {
    const medios = (doc.resumen?.medioPago || [])
      .map((m) => m.tipoMedioPago === '99'
        ? esc(m.medioPagoOtros)
        : d(6, m.tipoMedioPago))
      .join(', ');

    return `
<section class="bloque condiciones">
  <table class="kv horizontal">
    ${fila('Condición de venta', doc.condicionVenta === '99'
      ? esc(doc.condicionVentaOtros)
      : d(5, doc.condicionVenta))}
    ${fila('Plazo de crédito', doc.plazoCredito ? `${esc(doc.plazoCredito)} días` : '')}
    ${fila('Medio de pago', medios)}
  </table>
</section>`;
  },

  /** Tabla de líneas de detalle. Se omite sola si no hay líneas. */
  detalle(doc, ctx) {
    const lineas = doc.detalleServicio?.lineaDetalle || [];
    if (!lineas.length) return '';
    const m = ctx.moneda;

    const filas = lineas.map((L) => {
      const desc = (L.descuento || []).reduce((s, x) => s + Number(x.montoDescuento || 0), 0);
      const iva = (L.impuesto || []).find((i) => i.codigo === '01' || i.codigo === '07');
      return `
      <tr>
        <td class="num">${esc(L.numeroLinea)}</td>
        <td>
          <div class="detalle-txt">${esc(L.detalle)}</div>
          ${ctx.mostrarCabys && L.codigoCabys
            ? `<div class="cabys">CAByS ${esc(L.codigoCabys)}</div>` : ''}
        </td>
        <td class="num">${esc(L.cantidad)}</td>
        <td class="unidad">${d(15, L.unidadMedida)}</td>
        <td class="num">${monto(L.precioUnitario, m)}</td>
        ${ctx.mostrarDescuentos ? `<td class="num">${desc ? monto(desc, m) : '—'}</td>` : ''}
        <td class="num">${iva?.tarifa != null ? `${esc(iva.tarifa)}%` : '—'}</td>
        <td class="num total">${monto(L.montoTotalLinea, m)}</td>
      </tr>`;
    }).join('');

    return `
<section class="bloque detalle">
  <table class="lineas">
    <thead>
      <tr>
        <th>#</th><th>Descripción</th><th>Cant.</th><th>Unidad</th>
        <th>Precio</th>${ctx.mostrarDescuentos ? '<th>Desc.</th>' : ''}
        <th>IVA</th><th>Total</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
</section>`;
  },

  /**
   * Otros cargos. Aquí es donde se imprime una multa cuando el comprobante no
   * lleva líneas de detalle (nota 16, códigos 04, 08, 09 y 10).
   */
  otrosCargos(doc, ctx) {
    const cargos = doc.otrosCargos || [];
    if (!cargos.length) return '';

    const filas = cargos.map((c) => `
      <tr>
        <td>${c.tipoDocumentoOc === '99' ? esc(c.tipoDocumentoOtros) : d(16, c.tipoDocumentoOc)}</td>
        <td>${esc(c.detalle)}</td>
        <td class="num total">${monto(c.montoCargo, ctx.moneda)}</td>
      </tr>`).join('');

    return `
<section class="bloque otros-cargos">
  <h2>Otros cargos</h2>
  <table class="lineas">
    <thead><tr><th>Concepto</th><th>Detalle</th><th>Monto</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
</section>`;
  },

  /** Totales. Solo se imprime lo que existe. */
  totales(doc, ctx) {
    const r = doc.resumen || {};
    const m = ctx.moneda;
    const l = (etiqueta, valor, clase = '') => valor
      ? `<tr class="${clase}"><th>${esc(etiqueta)}</th><td>${monto(valor, m)}</td></tr>`
      : '';

    const desglose = (r.totalDesgloseImpuesto || []).map((t) => {
      const nombre = t.codigo === '01' && t.codigoTarifaIva
        ? `IVA ${cat.TARIFA_IVA[t.codigoTarifaIva]?.tarifa ?? ''}%`
        : cat.describir(8, t.codigo);
      return l(nombre, t.totalMontoImpuesto);
    }).join('');

    return `
<section class="bloque totales">
  <table class="kv totales-tabla">
    ${l('Total gravado', r.totalGravado)}
    ${l('Total exento', r.totalExento)}
    ${l('Total exonerado', r.totalExonerado)}
    ${l('Total no sujeto', r.totalNoSujeto)}
    ${l('Total venta', r.totalVenta)}
    ${l('Descuentos', r.totalDescuentos)}
    ${l('Total venta neta', r.totalVentaNeta)}
    ${desglose}
    ${l('Otros cargos', r.totalOtrosCargos)}
    ${l('IVA devuelto', r.totalIvaDevuelto)}
    <tr class="gran-total">
      <th>Total del comprobante</th>
      <td>${monto(r.totalComprobante, m)}</td>
    </tr>
  </table>
  ${m !== 'CRC' ? `<div class="tipo-cambio">Tipo de cambio: ${esc(r.codigoTipoMoneda?.tipoCambio)}</div>` : ''}
</section>`;
  },

  /** Documentos de referencia (notas de crédito, débito, etc.). */
  referencias(doc) {
    const refs = doc.informacionReferencia || [];
    if (!refs.length) return '';
    const filas = refs.map((r) => `
      <tr>
        <td>${r.tipoDocIr === '99' ? esc(r.tipoDocRefOtro) : d(10, r.tipoDocIr)}</td>
        <td class="mono">${esc(r.numero)}</td>
        <td>${esc(fecha(r.fechaEmisionIr))}</td>
        <td>${r.codigo === '99' ? esc(r.codigoReferenciaOtro) : d(9, r.codigo)}</td>
        <td>${esc(r.razon)}</td>
      </tr>`).join('');

    return `
<section class="bloque referencias">
  <h2>Documentos de referencia</h2>
  <table class="lineas">
    <thead><tr><th>Tipo</th><th>Número</th><th>Fecha</th><th>Código</th><th>Razón</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
</section>`;
  },

  /**
   * Campos personalizados del negocio: partido, árbitro, temporada.
   * Salen del nodo Otros del anexo, que es explícitamente de uso comercial y
   * no tributario. Es el lugar legítimo para los datos propios del cliente.
   */
  camposPersonalizados(doc, ctx) {
    const textos = [].concat(doc.otros?.otroTexto || []).filter(Boolean);
    const extra  = [].concat(doc.otros?.otroContenido || []).filter(Boolean);
    const todos = [...textos, ...extra];
    if (!todos.length) return '';

    const titulo = ctx.opciones?.titulo || 'Información adicional';
    return `
<section class="bloque campos-personalizados">
  <h2>${esc(titulo)}</h2>
  <ul>${todos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
</section>`;
  },

  /** Texto libre al pie: condiciones, agradecimiento, aviso legal. */
  piePagina(doc, ctx) {
    const texto = ctx.layout.piePagina;
    if (!texto) return '';
    return `<section class="bloque pie-pagina"><p>${esc(texto)}</p></section>`;
  },
};

/** Bloques que el editor no permite ocultar ni eliminar. */
const BLOQUES_REQUERIDOS = ['identificacion', 'totales'];

/** Metadatos para que el editor arme su panel sin duplicar esta lista. */
const CATALOGO_BLOQUES = [
  { tipo: 'encabezado',           nombre: 'Encabezado y emisor',    requerido: false },
  { tipo: 'identificacion',       nombre: 'Identificación del documento', requerido: true,
    ayuda: 'Tipo, clave y consecutivo deben ir juntos (nota 1 del anexo).' },
  { tipo: 'receptor',             nombre: 'Datos del receptor',     requerido: false },
  { tipo: 'condiciones',          nombre: 'Condiciones y pago',     requerido: false },
  { tipo: 'detalle',              nombre: 'Detalle de líneas',      requerido: false,
    opciones: ['mostrarCabys', 'mostrarDescuentos'] },
  { tipo: 'otrosCargos',          nombre: 'Otros cargos',           requerido: false },
  { tipo: 'totales',              nombre: 'Totales',                requerido: true },
  { tipo: 'referencias',          nombre: 'Documentos de referencia', requerido: false },
  { tipo: 'camposPersonalizados', nombre: 'Campos personalizados',  requerido: false,
    opciones: ['titulo'] },
  { tipo: 'piePagina',            nombre: 'Pie de página',          requerido: false },
];

module.exports = {
  BLOQUES,
  BLOQUES_REQUERIDOS,
  CATALOGO_BLOQUES,
  esc, monto, fecha, claveLegible, ubicacionTexto,
};
