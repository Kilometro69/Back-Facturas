/**
 * catalogoAdaptadores.js — Adaptadores predefinidos
 * -----------------------------------------------------------------------------
 * La plataforma da servicio a aplicaciones que no conocemos. No podemos
 * adivinar cómo nombra sus campos cada una, pero sí podemos cubrir las formas
 * de cobro que se repiten en casi cualquier negocio.
 *
 * Estructuralmente solo existen dos moldes:
 *
 *   SIN LÍNEAS  — el cobro va en "otros cargos" (nota 16). Multas, intereses,
 *                 depósitos de garantía. El anexo permite omitir el detalle
 *                 cuando el tipo de cargo es 04, 08, 09 o 10.
 *   CON LÍNEAS  — cada concepto es una línea con cantidad, precio e impuesto.
 *                 Productos, mensualidades, honorarios, reservas.
 *
 * La variedad del catálogo no está en la estructura sino en los valores por
 * defecto: el CAByS típico, la unidad de medida, la tarifa de IVA y los campos
 * no fiscales que suele llevar cada rubro. Eso es justamente lo que ahorra
 * trabajo al integrar.
 *
 * Cada adaptador trae `ejemploEntrada`: el JSON que enviaría esa aplicación.
 * Se usa para la vista previa del editor y para generar el código de ejemplo,
 * de modo que el cliente diseñe y se integre contra datos reales.
 * -----------------------------------------------------------------------------
 */

'use strict';

// -----------------------------------------------------------------------------
// Fragmentos que se repiten
// -----------------------------------------------------------------------------

/** Receptor: quien recibe el comprobante. */
const RECEPTOR = {
  'receptor.nombre':                '$.cliente.nombre',
  'receptor.identificacion.tipo':   { desde: '$.cliente.tipoIdentificacion', porDefecto: '01' },
  'receptor.identificacion.numero': { desde: '$.cliente.identificacion', transformar: 'soloDigitos' },
  'receptor.correoElectronico':     '$.cliente.email',
};

/**
 * Moneda y medio de pago.
 *
 * `rutaTotal` cambia según el molde: en los cobros sin líneas el total viene
 * en la raíz, y en las ventas dentro del objeto `totales`.
 *
 * El medio de pago usa `soloSi`: el anexo lo prohíbe cuando la condición de
 * venta es crédito. Si el cliente no lo envía, el nodo simplemente no aparece,
 * que es exactamente lo que corresponde en una venta a crédito.
 */
function monedaYPago(rutaTotal) {
  return {
    'resumen.codigoTipoMoneda.codigoMoneda': { desde: '$.moneda', porDefecto: 'CRC' },
    'resumen.codigoTipoMoneda.tipoCambio':   { desde: '$.tipoCambio', porDefecto: 1 },
    'resumen.medioPago[0].tipoMedioPago':    { desde: '$.medioPago', soloSi: '$.medioPago' },
    'resumen.medioPago[0].totalMedioPago':   { desde: rutaTotal, transformar: 'numero', soloSi: '$.medioPago' },
  };
}

/**
 * Totales de un cobro sin líneas de detalle.
 * No hay venta de bienes ni servicios: todo el monto es "otros cargos".
 */
const TOTALES_SIN_LINEAS = {
  'resumen.totalVenta':       { const: 0 },
  'resumen.totalVentaNeta':   { const: 0 },
  'resumen.totalOtrosCargos': { desde: '$.monto', transformar: 'numero' },
  'resumen.totalComprobante': { desde: '$.total', transformar: 'numero' },
};

/** Totales de una venta con líneas. El cliente los envía ya resueltos. */
const TOTALES_CON_LINEAS = {
  'resumen.totalServGravados':       '$.totales.serviciosGravados',
  'resumen.totalServExentos':        '$.totales.serviciosExentos',
  'resumen.totalMercanciasGravadas': '$.totales.mercanciasGravadas',
  'resumen.totalMercanciasExentas':  '$.totales.mercanciasExentas',
  'resumen.totalGravado':            '$.totales.gravado',
  'resumen.totalExento':             '$.totales.exento',
  'resumen.totalVenta':              '$.totales.venta',
  'resumen.totalDescuentos':         '$.totales.descuentos',
  'resumen.totalVentaNeta':          '$.totales.ventaNeta',
  'resumen.totalImpuesto':           '$.totales.impuesto',
  'resumen.totalOtrosCargos':        '$.totales.otrosCargos',
  'resumen.totalComprobante':        '$.totales.total',
  'resumen.totalDesgloseImpuesto[0].codigo':             { const: '01' },
  'resumen.totalDesgloseImpuesto[0].codigoTarifaIva':    { desde: '$.totales.codigoTarifa', porDefecto: '08' },
  'resumen.totalDesgloseImpuesto[0].totalMontoImpuesto': '$.totales.impuesto',
};

/** Línea de detalle estándar. `cabys` y `unidad` cambian según el rubro. */
function lineaDetalle({ cabysPorDefecto, unidadPorDefecto }) {
  return {
    'codigoCabys':                  { desde: '$.cabys', porDefecto: cabysPorDefecto },
    'cantidad':                     { desde: '$.cantidad', porDefecto: 1, transformar: 'numero' },
    'unidadMedida':                 { desde: '$.unidad', porDefecto: unidadPorDefecto },
    'detalle':                      '$.descripcion',
    'precioUnitario':               { desde: '$.precioUnitario', transformar: 'numero' },
    'montoTotal':                   { desde: '$.montoTotal', transformar: 'numero' },
    'subTotal':                     { desde: '$.subTotal', transformar: 'numero' },
    'baseImponible':                { desde: '$.baseImponible', transformar: 'numero' },
    'impuesto[0].codigo':           { const: '01' },
    'impuesto[0].codigoTarifaIva':  { desde: '$.codigoTarifa', porDefecto: '08' },
    'impuesto[0].tarifa':           { desde: '$.tarifa', porDefecto: 13 },
    'impuesto[0].monto':            { desde: '$.montoImpuesto', transformar: 'numero' },
    'impuestoAsumidoEmisorFabrica': { desde: '$.impuestoAsumido', porDefecto: 0 },
    'impuestoNeto':                 { desde: '$.impuestoNeto', transformar: 'numero' },
    'montoTotalLinea':              { desde: '$.totalLinea', transformar: 'numero' },
  };
}

/** Cobro que va en "otros cargos". `tipoDocumentoOc` sale de la nota 16. */
function otroCargo(tipoDocumentoOc) {
  return {
    'otrosCargos[0].tipoDocumentoOc': { const: tipoDocumentoOc },
    'otrosCargos[0].detalle':         '$.concepto',
    'otrosCargos[0].montoCargo':      { desde: '$.monto', transformar: 'numero' },
  };
}

const clienteEjemplo = {
  nombre: 'Ana Solís Vargas',
  tipoIdentificacion: '01',
  identificacion: '1-1234-5678',
  email: 'ana@correo.cr',
};

// -----------------------------------------------------------------------------
// Catálogo
// -----------------------------------------------------------------------------

const CATALOGO = [

  // ======================= SIN LÍNEAS DE DETALLE =======================

  {
    nombre: 'multa',
    titulo: 'Multas y penalizaciones',
    categoria: 'Cobros sin producto',
    descripcion:
      'Sanciones disciplinarias, recargos por incumplimiento o penalizaciones ' +
      'contractuales. No hay venta de por medio, así que el comprobante no ' +
      'lleva líneas de detalle.',
    paraQuien: 'Clubes deportivos, condominios, gimnasios, bibliotecas',
    tipoComprobante: 'FE',
    mapeo: {
      'condicionVenta': { const: '01' },
      ...RECEPTOR,
      ...otroCargo('09'),
      ...TOTALES_SIN_LINEAS,
      ...monedaYPago('$.total'),
    },
    metadata: ['$.referencia', '$.fechaHecho', '$.observaciones'],
    ejemploEntrada: {
      cliente: clienteEjemplo,
      concepto: 'Tarjeta roja — jornada 8',
      monto: 15000,
      total: 15000,
      medioPago: '06',
      referencia: 'Partido: Club Ejemplo vs Deportivo Sur',
      fechaHecho: '12/08/2026',
    },
  },

  {
    nombre: 'intereses-moratorios',
    titulo: 'Intereses moratorios',
    categoria: 'Cobros sin producto',
    descripcion:
      'Recargo por pago tardío de una factura anterior. Usa el código 10 de la ' +
      'nota 16 y suele referenciar el documento que se atrasó.',
    paraQuien: 'Financieras, arrendadoras, servicios por suscripción',
    tipoComprobante: 'FE',
    mapeo: {
      'condicionVenta': { const: '01' },
      ...RECEPTOR,
      ...otroCargo('10'),
      ...TOTALES_SIN_LINEAS,
      ...monedaYPago('$.total'),
      'otrosCargos[0].porcentajeOc': { desde: '$.tasaInteres', porDefecto: undefined },
    },
    metadata: ['$.facturaOrigen', '$.diasAtraso'],
    ejemploEntrada: {
      cliente: clienteEjemplo,
      concepto: 'Intereses por mora — factura 00100001010000000123',
      monto: 4500,
      total: 4500,
      tasaInteres: 2.5,
      medioPago: '04',
      facturaOrigen: 'Factura 00100001010000000123',
      diasAtraso: '45 días de atraso',
    },
  },

  {
    nombre: 'deposito-garantia',
    titulo: 'Depósitos de garantía',
    categoria: 'Cobros sin producto',
    descripcion:
      'Monto que se retiene como respaldo y puede devolverse después. Código 08 ' +
      'de la nota 16. La devolución se documenta con una nota de crédito.',
    paraQuien: 'Alquileres, alquiler de equipo, eventos',
    tipoComprobante: 'FE',
    mapeo: {
      'condicionVenta': { const: '01' },
      ...RECEPTOR,
      ...otroCargo('08'),
      ...TOTALES_SIN_LINEAS,
      ...monedaYPago('$.total'),
    },
    metadata: ['$.contrato', '$.vigencia'],
    ejemploEntrada: {
      cliente: clienteEjemplo,
      concepto: 'Depósito de garantía — alquiler de salón',
      monto: 100000,
      total: 100000,
      medioPago: '04',
      contrato: 'Contrato 2026-084',
      vigencia: 'Reembolsable hasta 30/09/2026',
    },
  },

  // ======================= CON LÍNEAS DE DETALLE =======================

  {
    nombre: 'venta-productos',
    titulo: 'Venta de productos',
    categoria: 'Venta',
    descripcion:
      'Comercio de mercancías físicas. Cada producto es una línea con cantidad, ' +
      'precio unitario e IVA. Admite descuentos por línea.',
    paraQuien: 'Tiendas, comercios en línea, distribuidoras',
    tipoComprobante: 'FE',
    mapeo: {
      'condicionVenta':  { desde: '$.condicionVenta', porDefecto: '01' },
      'plazoCredito':    { desde: '$.plazoCredito', porDefecto: undefined },
      ...RECEPTOR,
      ...TOTALES_CON_LINEAS,
      ...monedaYPago('$.totales.total'),
    },
    lineas: {
      desde: '$.productos',
      mapeo: {
        ...lineaDetalle({ cabysPorDefecto: '4799900000000', unidadPorDefecto: 'Unid' }),
        // soloSi es la pieza clave: sin descuento, este bloque completo no debe existir en el
        // comprobante (el validador exige montoDescuento en cuanto hay UN elemento en el arreglo
        // "descuento", asi que escribir codigoDescuento con un valor por defecto incondicional
        // creaba ese elemento a medias y la factura sin descuento quedaba invalida por un campo
        // que el cliente nunca pidio).
        'descuento[0].montoDescuento':  { desde: '$.descuento', transformar: 'numero', soloSi: '$.descuento' },
        'descuento[0].codigoDescuento': { desde: '$.codigoDescuento', porDefecto: '07', soloSi: '$.descuento' },
      },
    },
    metadata: ['$.numeroOrden', '$.notaEntrega'],
    ejemploEntrada: {
      cliente: clienteEjemplo,
      medioPago: '02',
      numeroOrden: 'Orden #4821',
      productos: [
        {
          descripcion: 'Camiseta oficial talla M', cantidad: 2, unidad: 'Unid',
          precioUnitario: 18000, montoTotal: 36000, subTotal: 36000,
          baseImponible: 36000, montoImpuesto: 4680, impuestoNeto: 4680,
          totalLinea: 40680,
        },
        {
          descripcion: 'Botella deportiva 750 ml', cantidad: 1, unidad: 'Unid',
          precioUnitario: 7500, descuento: 500, montoTotal: 7500, subTotal: 7000,
          baseImponible: 7000, montoImpuesto: 910, impuestoNeto: 910,
          totalLinea: 7910,
        },
      ],
      totales: {
        mercanciasGravadas: 43500, gravado: 43500, venta: 43500,
        descuentos: 500, ventaNeta: 43000, impuesto: 5590, total: 48590,
      },
    },
  },

  {
    nombre: 'mensualidad',
    titulo: 'Mensualidades y matrículas',
    categoria: 'Venta',
    descripcion:
      'Cobro periódico de un cupo o inscripción. Suele incluir el período y el ' +
      'nombre del estudiante o participante como datos no fiscales.',
    paraQuien: 'Escuelas, academias, universidades, gimnasios',
    tipoComprobante: 'FE',
    mapeo: {
      'condicionVenta': { desde: '$.condicionVenta', porDefecto: '01' },
      ...RECEPTOR,
      ...TOTALES_CON_LINEAS,
      ...monedaYPago('$.totales.total'),
    },
    lineas: {
      desde: '$.conceptos',
      mapeo: lineaDetalle({ cabysPorDefecto: '9219000000000', unidadPorDefecto: 'Unid' }),
    },
    metadata: ['$.estudiante', '$.periodo', '$.grupo'],
    ejemploEntrada: {
      cliente: clienteEjemplo,
      medioPago: '04',
      estudiante: 'Estudiante: Mateo Solís',
      periodo: 'Período: agosto 2026',
      grupo: 'Grupo: Infantil B',
      conceptos: [
        {
          descripcion: 'Mensualidad agosto 2026', cantidad: 1, unidad: 'Unid',
          precioUnitario: 45000, montoTotal: 45000, subTotal: 45000,
          baseImponible: 45000, codigoTarifa: '10', tarifa: 0,
          montoImpuesto: 0, impuestoNeto: 0, totalLinea: 45000,
        },
      ],
      totales: {
        serviciosExentos: 45000, exento: 45000, venta: 45000,
        ventaNeta: 45000, total: 45000, codigoTarifa: '10', impuesto: 0,
      },
    },
  },

  {
    nombre: 'servicios-profesionales',
    titulo: 'Servicios profesionales',
    categoria: 'Venta',
    descripcion:
      'Honorarios por horas o por proyecto. Usa la unidad de medida "Sp" que el ' +
      'anexo reserva para servicios profesionales.',
    paraQuien: 'Consultores, despachos, agencias, desarrolladores',
    tipoComprobante: 'FE',
    mapeo: {
      'condicionVenta': { desde: '$.condicionVenta', porDefecto: '01' },
      'plazoCredito':   { desde: '$.plazoCredito', porDefecto: undefined },
      ...RECEPTOR,
      ...TOTALES_CON_LINEAS,
      ...monedaYPago('$.totales.total'),
    },
    lineas: {
      desde: '$.servicios',
      mapeo: lineaDetalle({ cabysPorDefecto: '8311000000000', unidadPorDefecto: 'Sp' }),
    },
    metadata: ['$.proyecto', '$.periodo', '$.ordenCompra'],
    ejemploEntrada: {
      cliente: { ...clienteEjemplo, nombre: 'Comercial del Valle S.A.', tipoIdentificacion: '02', identificacion: '3101987654' },
      condicionVenta: '02',
      plazoCredito: 30,
      proyecto: 'Proyecto: rediseño del portal',
      periodo: 'Julio 2026',
      servicios: [
        {
          descripcion: 'Desarrollo de módulo de reportes', cantidad: 24, unidad: 'Sp',
          precioUnitario: 25000, montoTotal: 600000, subTotal: 600000,
          baseImponible: 600000, montoImpuesto: 78000, impuestoNeto: 78000,
          totalLinea: 678000,
        },
      ],
      totales: {
        serviciosGravados: 600000, gravado: 600000, venta: 600000,
        ventaNeta: 600000, impuesto: 78000, total: 678000,
      },
    },
  },

  {
    nombre: 'suscripcion',
    titulo: 'Suscripciones',
    categoria: 'Venta',
    descripcion:
      'Cobro recurrente por acceso a un servicio. Incluye el período facturado ' +
      'y el plan como datos no fiscales.',
    paraQuien: 'Software por suscripción, membresías, servicios en línea',
    tipoComprobante: 'FE',
    mapeo: {
      'condicionVenta': { const: '01' },
      ...RECEPTOR,
      ...TOTALES_CON_LINEAS,
      ...monedaYPago('$.totales.total'),
    },
    lineas: {
      desde: '$.conceptos',
      mapeo: lineaDetalle({ cabysPorDefecto: '8434000000000', unidadPorDefecto: 'Unid' }),
    },
    metadata: ['$.plan', '$.periodoFacturado', '$.proximaRenovacion'],
    ejemploEntrada: {
      cliente: clienteEjemplo,
      medioPago: '02',
      plan: 'Plan: Profesional',
      periodoFacturado: 'Del 01/08/2026 al 31/08/2026',
      proximaRenovacion: 'Renueva el 01/09/2026',
      conceptos: [
        {
          descripcion: 'Suscripción mensual — Plan Profesional', cantidad: 1, unidad: 'Unid',
          precioUnitario: 30000, montoTotal: 30000, subTotal: 30000,
          baseImponible: 30000, montoImpuesto: 3900, impuestoNeto: 3900,
          totalLinea: 33900,
        },
      ],
      totales: {
        serviciosGravados: 30000, gravado: 30000, venta: 30000,
        ventaNeta: 30000, impuesto: 3900, total: 33900,
      },
    },
  },

  {
    nombre: 'reserva',
    titulo: 'Reservas y citas',
    categoria: 'Venta',
    descripcion:
      'Cobro de un espacio, cita o estadía. Suele mostrar fecha, hora y ' +
      'ubicación del servicio reservado.',
    paraQuien: 'Hoteles, clínicas, salones, canchas, talleres',
    tipoComprobante: 'FE',
    mapeo: {
      'condicionVenta': { const: '01' },
      ...RECEPTOR,
      ...TOTALES_CON_LINEAS,
      ...monedaYPago('$.totales.total'),
    },
    lineas: {
      desde: '$.servicios',
      mapeo: lineaDetalle({ cabysPorDefecto: '6311000000000', unidadPorDefecto: 'Unid' }),
    },
    metadata: ['$.fechaServicio', '$.horario', '$.ubicacion'],
    ejemploEntrada: {
      cliente: clienteEjemplo,
      medioPago: '06',
      fechaServicio: 'Fecha: 24/08/2026',
      horario: 'Horario: 6:00 p. m. a 8:00 p. m.',
      ubicacion: 'Cancha 2',
      servicios: [
        {
          descripcion: 'Alquiler de cancha — 2 horas', cantidad: 2, unidad: 'h',
          precioUnitario: 12000, montoTotal: 24000, subTotal: 24000,
          baseImponible: 24000, montoImpuesto: 3120, impuestoNeto: 3120,
          totalLinea: 27120,
        },
      ],
      totales: {
        serviciosGravados: 24000, gravado: 24000, venta: 24000,
        ventaNeta: 24000, impuesto: 3120, total: 27120,
      },
    },
  },
];

const POR_NOMBRE = new Map(CATALOGO.map((a) => [a.nombre, a]));

/** Agrupado por categoría, para el selector del panel. */
function porCategoria() {
  const grupos = {};
  for (const a of CATALOGO) {
    (grupos[a.categoria] ||= []).push({
      nombre: a.nombre,
      titulo: a.titulo,
      descripcion: a.descripcion,
      paraQuien: a.paraQuien,
      conLineas: Boolean(a.lineas),
    });
  }
  return grupos;
}

const obtener = (nombre) => POR_NOMBRE.get(nombre) || null;

module.exports = { CATALOGO, POR_NOMBRE, obtener, porCategoria };
