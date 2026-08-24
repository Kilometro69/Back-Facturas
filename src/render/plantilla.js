/**
 * plantilla.js — Ensamblado del HTML del comprobante
 * -----------------------------------------------------------------------------
 * Este módulo produce el HTML que se usa para DOS cosas:
 *   1. El preview en vivo del editor (React lo mete en un iframe).
 *   2. La impresión a PDF con Puppeteer.
 *
 * Es el mismo HTML en ambos casos, a propósito. Si el preview y el PDF se
 * generaran por caminos distintos, se verían distinto y perseguir esas
 * diferencias consume más tiempo que construir el resto del proyecto.
 * -----------------------------------------------------------------------------
 */

'use strict';

const { BLOQUES, BLOQUES_REQUERIDOS, esc } = require('./bloques');
const cat = require('../../core/catalogos');

const NOMBRE_TIPO_COMPROBANTE = {
  FE:  'FACTURA ELECTRÓNICA',
  FEE: 'FACTURA ELECTRÓNICA DE EXPORTACIÓN',
  FEC: 'FACTURA ELECTRÓNICA DE COMPRA',
  TE:  'TIQUETE ELECTRÓNICO',
  NC:  'NOTA DE CRÉDITO ELECTRÓNICA',
  ND:  'NOTA DE DÉBITO ELECTRÓNICA',
  REP: 'RECIBO ELECTRÓNICO DE PAGO',
};

/** Layout mínimo si una plantilla viene sin bloques configurados. */
const LAYOUT_POR_DEFECTO = [
  { tipo: 'encabezado',           visible: true },
  { tipo: 'identificacion',       visible: true },
  { tipo: 'receptor',             visible: true },
  { tipo: 'condiciones',          visible: true },
  { tipo: 'detalle',              visible: true, opciones: { mostrarCabys: false, mostrarDescuentos: true } },
  { tipo: 'otrosCargos',          visible: true },
  { tipo: 'totales',              visible: true },
  { tipo: 'referencias',          visible: true },
  { tipo: 'camposPersonalizados', visible: true },
  { tipo: 'piePagina',            visible: true },
];

// -----------------------------------------------------------------------------
// Estilos
// -----------------------------------------------------------------------------

function estilos(branding) {
  const b = {
    colorPrimario: '#1a3a5c',
    colorTexto:    '#222222',
    colorFondo:    '#ffffff',
    fuente:        'Helvetica, Arial, sans-serif',
    ...branding,
  };

  return `
:root {
  --primario: ${esc(b.colorPrimario)};
  --texto: ${esc(b.colorTexto)};
  --fondo: ${esc(b.colorFondo)};
  --tenue: color-mix(in srgb, var(--texto) 55%, transparent);
  --borde: color-mix(in srgb, var(--texto) 15%, transparent);
  --realce: color-mix(in srgb, var(--primario) 7%, transparent);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ${b.fuente};
  color: var(--texto);
  background: var(--fondo);
  font-size: 10.5pt;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.comprobante { padding: 14mm 12mm; max-width: 210mm; margin: 0 auto; }
.bloque { margin-bottom: 7mm; }
.bloque:last-child { margin-bottom: 0; }

h1 { font-size: 15pt; margin: 0 0 1mm; color: var(--primario); letter-spacing: -.2pt; }
h2 {
  font-size: 8.5pt; text-transform: uppercase; letter-spacing: .6pt;
  color: var(--primario); margin: 0 0 2mm;
  border-bottom: 1px solid var(--borde); padding-bottom: 1mm;
}

/* Encabezado */
.encabezado { display: flex; gap: 6mm; align-items: flex-start; }
.encabezado .logo { max-height: 22mm; max-width: 45mm; object-fit: contain; }
.encabezado .emisor { flex: 1; }
.encabezado .razon { font-size: 9pt; color: var(--tenue); margin-bottom: 1mm; }
.encabezado .linea { font-size: 9pt; color: var(--tenue); }

/* Identificación: bloque atómico (nota 1) */
.identificacion {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm;
  background: var(--realce); border-left: 3px solid var(--primario);
  padding: 4mm 5mm; border-radius: 2px;
}
.identificacion .tipo-documento {
  font-weight: 700; font-size: 11pt; color: var(--primario);
  letter-spacing: .3pt; margin-bottom: 2mm;
}
.identificacion .clave {
  font-family: 'Courier New', monospace; font-size: 8.5pt; letter-spacing: .2pt;
  word-break: break-all;
}
.identificacion .qr { width: 24mm; height: 24mm; }

/* Tablas clave-valor */
table.kv { border-collapse: collapse; width: 100%; }
table.kv th {
  text-align: left; font-weight: 600; font-size: 8.5pt; color: var(--tenue);
  padding: .6mm 4mm .6mm 0; white-space: nowrap; vertical-align: top; width: 1%;
}
table.kv td { padding: .6mm 0; font-size: 9.5pt; vertical-align: top; }
table.kv.horizontal { display: flex; gap: 10mm; }
table.kv.horizontal tbody { display: flex; gap: 10mm; }
table.kv.horizontal tr { display: block; }
table.kv.horizontal th { display: block; padding: 0; }

/* Tablas de líneas */
table.lineas { width: 100%; border-collapse: collapse; font-size: 9pt; }
table.lineas thead th {
  background: var(--realce); color: var(--primario);
  font-size: 8pt; text-transform: uppercase; letter-spacing: .4pt;
  text-align: left; padding: 2mm; border-bottom: 1px solid var(--borde);
}
table.lineas td { padding: 2mm; border-bottom: 1px solid var(--borde); vertical-align: top; }
table.lineas .num { text-align: right; white-space: nowrap; }
table.lineas .total { font-weight: 600; }
table.lineas .unidad { font-size: 8.5pt; color: var(--tenue); }
.detalle-txt { font-weight: 500; }
.cabys { font-size: 7.5pt; color: var(--tenue); font-family: 'Courier New', monospace; }

/* Totales */
.totales { display: flex; justify-content: flex-end; }
.totales-tabla { width: 78mm; }
.totales-tabla th { text-align: left; font-weight: 400; color: var(--tenue); padding: 1mm 0; }
.totales-tabla td { text-align: right; padding: 1mm 0; white-space: nowrap; }
.totales-tabla .gran-total th,
.totales-tabla .gran-total td {
  border-top: 1.5px solid var(--primario); padding-top: 2mm;
  font-weight: 700; font-size: 12pt; color: var(--primario);
}
.tipo-cambio { text-align: right; font-size: 8pt; color: var(--tenue); margin-top: 1mm; }

/* Campos personalizados y pie */
.campos-personalizados ul { margin: 0; padding-left: 5mm; font-size: 9pt; }
.pie-pagina {
  border-top: 1px solid var(--borde); padding-top: 3mm;
  font-size: 8pt; color: var(--tenue); text-align: center;
}
.pie-pagina p { margin: 0; }
.mono { font-family: 'Courier New', monospace; font-size: 8pt; }

/* Anulado */
.anulado::after {
  content: 'ANULADO'; position: fixed; top: 40%; left: 50%;
  transform: translate(-50%, -50%) rotate(-25deg);
  font-size: 60pt; font-weight: 800; color: rgba(200, 30, 30, .13);
  letter-spacing: 6pt; pointer-events: none;
}

/* Impresión: nunca partir una tabla de líneas por la mitad de una fila */
@page { size: A4; margin: 0; }
@media print {
  .bloque { break-inside: avoid; }
  table.lineas tr { break-inside: avoid; }
  table.lineas thead { display: table-header-group; }
}`;
}

// -----------------------------------------------------------------------------
// Render
// -----------------------------------------------------------------------------

/**
 * @param {object} doc        comprobante canónico ya calculado y validado
 * @param {object} plantilla  { branding, layout } — snapshot, no referencia
 * @param {object} extra      { tipoComprobante, qrDataUri, anulado, nombresUbicacion* }
 * @returns {string} HTML completo
 */
function renderHtml(doc, plantilla = {}, extra = {}) {
  const branding = plantilla.branding || {};
  const layout = plantilla.layout || {};
  const bloques = (layout.bloques?.length ? layout.bloques : LAYOUT_POR_DEFECTO);

  const tipo = extra.tipoComprobante || 'FE';

  const ctxBase = {
    branding,
    layout,
    moneda: doc.resumen?.codigoTipoMoneda?.codigoMoneda || 'CRC',
    nombreTipoComprobante: NOMBRE_TIPO_COMPROBANTE[tipo] || tipo,
    tipoComprobante: tipo,
    mostrarQr: Boolean(layout.mostrarQr && extra.qrDataUri),
    qrDataUri: extra.qrDataUri,
    nombresUbicacionEmisor: extra.nombresUbicacionEmisor || {},
    nombresUbicacionReceptor: extra.nombresUbicacionReceptor || {},
  };

  // Un bloque requerido que falte se agrega al final: el PDF nunca puede salir
  // sin identificación ni sin totales, aunque la plantilla venga corrupta.
  const presentes = new Set(bloques.filter((b) => b.visible !== false).map((b) => b.tipo));
  const completos = [...bloques];
  for (const req of BLOQUES_REQUERIDOS) {
    if (!presentes.has(req)) completos.push({ tipo: req, visible: true });
  }

  const cuerpo = completos
    .filter((b) => b.visible !== false)
    .map((b) => {
      const fn = BLOQUES[b.tipo];
      if (!fn) return ''; // bloque desconocido: se ignora, no se rompe el PDF
      const ctx = { ...ctxBase, opciones: b.opciones || {}, ...(b.opciones || {}) };
      try {
        return fn(doc, ctx);
      } catch (err) {
        // Un bloque que falla no debe tumbar todo el comprobante.
        console.error(`Error al renderizar el bloque "${b.tipo}":`, err.message);
        return '';
      }
    })
    .join('\n');

  const clases = ['comprobante', extra.anulado ? 'anulado' : ''].filter(Boolean).join(' ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(ctxBase.nombreTipoComprobante)} ${esc(doc.numeroConsecutivo || '')}</title>
<style>${estilos(branding)}</style>
</head>
<body>
<div class="${clases}">
${cuerpo}
</div>
</body>
</html>`;
}

/**
 * Valida un layout enviado desde el editor. El frontend puede fallar o alguien
 * puede llamar la API directamente: la garantía se aplica del lado del servidor.
 */
function validarLayout(layout) {
  const errores = [];
  const bloques = layout?.bloques || [];

  const tipos = bloques.map((b) => b.tipo);
  for (const req of BLOQUES_REQUERIDOS) {
    const b = bloques.find((x) => x.tipo === req);
    if (!b) errores.push(`falta el bloque requerido "${req}"`);
    else if (b.visible === false) errores.push(`el bloque "${req}" no se puede ocultar`);
  }
  for (const t of tipos) {
    if (!BLOQUES[t]) errores.push(`bloque desconocido: "${t}"`);
  }
  const repetidos = tipos.filter((t, i) => tipos.indexOf(t) !== i);
  if (repetidos.length) errores.push(`bloques duplicados: ${[...new Set(repetidos)].join(', ')}`);

  return errores;
}

module.exports = {
  renderHtml,
  validarLayout,
  estilos,
  LAYOUT_POR_DEFECTO,
  NOMBRE_TIPO_COMPROBANTE,
};
