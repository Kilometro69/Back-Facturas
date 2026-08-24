/**
 * catalogos.js
 * -----------------------------------------------------------------------------
 * Catálogos oficiales del Anexo v4.4 (las "notas" del documento).
 *
 * Cumplen doble función:
 *   1. Validación: verificar que un código enviado existe.
 *   2. Nota 7 del anexo: "Para efectos de visualización e impresión se mostrará
 *      su descripción". El PDF NUNCA debe imprimir "01", siempre "Contado".
 *
 * En producción esto se siembra en la colección `catalogs` de Mongo para que el
 * editor de plantillas arme sus dropdowns sin duplicar la tabla.
 *
 * Catálogos externos que NO se incluyen aquí (son archivos aparte de Hacienda,
 * demasiado grandes para embeber):
 *   - Nota 13.1  códigos de moneda      -> "Codigodemoneda_V4.4"
 *   - Nota 14    provincia/cantón/dist. -> "Codificacionubicacion_V4.4"
 *   - Nota 17    CAByS                  -> catálogo del BCCR
 *   - Nota 19    forma farmacéutica     -> "Código de forma Farmacéutica"
 * -----------------------------------------------------------------------------
 */

'use strict';

/** Nota 4 — Tipo de identificación */
const TIPO_IDENTIFICACION = {
  '01': 'Cédula Física',
  '02': 'Cédula Jurídica',
  '03': 'DIMEX',
  '04': 'NITE',
  '05': 'Extranjero No Domiciliado', // solo FEC (emisor) / FE con condición 12
  '06': 'No Contribuyente',          // solo FEC con condición de venta 13
};

/** Nota 4.1 — Relleno con ceros para armar la clave numérica (12 posiciones) */
const RELLENO_CEDULA_CLAVE = {
  '01': 3, // cédula física: 9 dígitos + 3 ceros
  '02': 2, // jurídica: 10 dígitos + 2 ceros
  '03': 0, // DIMEX: 11 o 12; si 11, se agrega 1 cero (se resuelve por largo)
  '04': 2, // NITE: 10 dígitos + 2 ceros
};

/** Nota 5 — Condiciones de la venta */
const CONDICION_VENTA = {
  '01': 'Contado',
  '02': 'Crédito',
  '03': 'Consignación',
  '04': 'Apartado',
  '05': 'Arrendamiento con opción de compra',
  '06': 'Arrendamiento en función financiera',
  '07': 'Cobro a favor de un tercero',
  '08': 'Servicios prestados al Estado',
  '09': 'Pago de servicios prestado al Estado',        // solo REP
  '10': 'Venta a crédito en IVA hasta 90 días (Art. 27, LIVA)',
  '11': 'Pago de venta a crédito en IVA hasta 90 días (Art. 27, LIVA)', // solo REP
  '12': 'Venta Mercancía No Nacionalizada',            // solo FE
  '13': 'Venta Bienes Usados No Contribuyente',
  '14': 'Arrendamiento Operativo',
  '15': 'Arrendamiento Financiero',
  '99': 'Otros',
};

/** Condiciones de venta que son crédito: NO llevan medio de pago */
const CONDICIONES_CREDITO = ['02', '08', '10'];

/** Nota 6 — Medios de pago */
const MEDIO_PAGO = {
  '01': 'Efectivo',
  '02': 'Tarjeta',
  '03': 'Cheque',
  '04': 'Transferencia – depósito bancario',
  '05': 'Recaudado por terceros',
  '06': 'SINPE MÓVIL',
  '07': 'Plataforma Digital',
  '99': 'Otros',
};

/** Nota 8 — Códigos de impuesto */
const CODIGO_IMPUESTO = {
  '01': 'Impuesto al Valor Agregado',
  '02': 'Impuesto Selectivo de Consumo',
  '03': 'Impuesto Único a los Combustibles',
  '04': 'Impuesto específico de Bebidas Alcohólicas',
  '05': 'Impuesto Específico sobre bebidas envasadas sin contenido alcohólico y jabones de tocador',
  '06': 'Impuesto a los Productos de Tabaco',
  '07': 'IVA (cálculo especial)',
  '08': 'IVA Régimen de Bienes Usados (Factor)',
  '12': 'Impuesto Específico al Cemento',
  '99': 'Otros',
};

/** Nota 8.1 — Tarifas del IVA. `tarifa: null` = no tiene porcentaje fijo. */
const TARIFA_IVA = {
  '01': { descripcion: 'Tarifa 0% (Artículo 32, num 1, RLIVA)', tarifa: 0 },
  '02': { descripcion: 'Tarifa reducida 1%',                    tarifa: 1 },
  '03': { descripcion: 'Tarifa reducida 2%',                    tarifa: 2 },
  '04': { descripcion: 'Tarifa reducida 4%',                    tarifa: 4 },
  '05': { descripcion: 'Transitorio 0%',                        tarifa: 0,  soloNotas: true },
  '06': { descripcion: 'Transitorio 4%',                        tarifa: 4,  soloNotas: true },
  '07': { descripcion: 'Tarifa transitoria 8%',                 tarifa: 8,  soloNotas: true, inhabilitado: true },
  '08': { descripcion: 'Tarifa general 13%',                    tarifa: 13 },
  '09': { descripcion: 'Tarifa reducida 0.5%',                  tarifa: 0.5 },
  '10': { descripcion: 'Tarifa Exenta',                         tarifa: 0 },
  '11': { descripcion: 'Tarifa 0% sin derecho a crédito',       tarifa: 0 },
};

/** Nota 9 — Códigos de referencia */
const CODIGO_REFERENCIA = {
  '01': 'Anula Documento de Referencia',
  '02': 'Corrige monto',
  '04': 'Referencia a otro documento',
  '05': 'Sustituye comprobante provisional por contingencia',
  '06': 'Devolución de mercancía',
  '07': 'Sustituye comprobante electrónico',
  '08': 'Factura Endosada',
  '09': 'Nota de crédito financiera',
  '10': 'Nota de débito financiera',
  '11': 'Proveedor No Domiciliado',
  '12': 'Crédito por exoneración posterior a la facturación',
  '99': 'Otros',
};

/** Nota 10 — Tipo de documento de referencia */
const TIPO_DOC_REFERENCIA = {
  '01': 'Factura electrónica',
  '02': 'Nota de débito electrónica',
  '03': 'Nota de crédito electrónica',
  '04': 'Tiquete electrónico',
  '05': 'Nota de despacho',
  '06': 'Contrato',
  '07': 'Procedimiento',
  '08': 'Comprobante emitido en contingencia',
  '09': 'Devolución mercadería',
  '10': 'Comprobante electrónico rechazado por el Ministerio de Hacienda',
  '11': 'Sustituye factura rechazada por el Receptor del comprobante',
  '12': 'Sustituye Factura de exportación',
  '13': 'Facturación mes vencido',
  '14': 'Comprobante aportado por contribuyente de Régimen Especial',
  '15': 'Sustituye una Factura electrónica de Compra',
  '16': 'Comprobante de Proveedor No Domiciliado', // solo FEC
  '17': 'Nota de Crédito a Factura Electrónica de Compra',
  '18': 'Nota de Débito a Factura Electrónica de Compra',
  '99': 'Otros',
};

/** Nota 10.1 — Tipo de documento de exoneración o autorización */
const TIPO_DOC_EXONERACION = {
  '01': 'Compras autorizadas por la Dirección General de Tributación',
  '02': 'Ventas exentas a diplomáticos',
  '03': 'Autorizado por Ley especial',
  '04': 'Exenciones DGH Autorización Local Genérica',
  '05': 'Exenciones DGH Transitorio V',
  '06': 'Servicios turísticos inscritos ante el ICT',
  '07': 'Transitorio XVII (Reciclaje y reutilizable)',
  '08': 'Exoneración a Zona Franca',
  '09': 'Exoneración de servicios complementarios para la exportación (art. 11 RLIVA)',
  '10': 'Órgano de las corporaciones municipales',
  '11': 'Exenciones DGH Autorización de Impuesto Local Concreta',
  '99': 'Otros',
};

/** Nota 12 — Tipo de código de producto/servicio */
const TIPO_CODIGO_COMERCIAL = {
  '01': 'Código del producto del vendedor',
  '02': 'Código del producto del comprador',
  '03': 'Código asignado por el fabricante (industriales o importadores)',
  '04': 'Código uso interno',
  '99': 'Otros',
};

/**
 * Nota 15 — Unidades de medida. Subconjunto de uso frecuente en servicios.
 * El catálogo completo del anexo trae ~140 símbolos del SI. Sembrar todos en
 * Mongo; aquí quedan los relevantes para un servicio de facturación general.
 */
const UNIDAD_MEDIDA = {
  Unid: 'Unidad',
  Sp: 'Servicios Profesionales',
  Spe: 'Servicios personales',
  St: 'Servicios técnicos',
  Os: 'Otro tipo de servicio',
  Al: 'Alquiler de uso habitacional',
  Alc: 'Alquiler de uso comercial',
  Cm: 'Comisiones',
  I: 'Intereses',
  Acv: 'Activo Virtual',
  h: 'hora',
  D: 'día',
  Kg: 'Kilogramo',
  G: 'Gramo',
  L: 'litro',
  mL: 'mililitro',
  M: 'Metro',
  'm²': 'metro cuadrado',
  'm³': 'metro cúbico',
  Otros: 'Se debe indicar la descripción de la medida a utilizar',
};

/** Nota 16 — Tipo de documento de otros cargos. AQUÍ VIVE LA MULTA (09). */
const TIPO_DOC_OTROS_CARGOS = {
  '01': 'Contribución parafiscal',
  '02': 'Timbre de la Cruz Roja',
  '03': 'Timbre del Benemérito Cuerpo de Bomberos de Costa Rica',
  '04': 'Cobro de un tercero',
  '05': 'Costos de Exportación',
  '06': 'Impuesto de servicio 10%',
  '07': 'Timbre de Colegios Profesionales',
  '08': 'Depósitos de Garantía',
  '09': 'Multas o Penalizaciones',
  '10': 'Intereses Moratorios',
  '99': 'Otros Cargos',
};

/**
 * Códigos de "otros cargos" que eximen de incluir el nodo detalleServicio
 * cuando no hay línea de producto o servicio. Regla clave para las multas.
 */
const OTROS_CARGOS_SIN_DETALLE = ['04', '08', '09', '10'];

/** Nota 20 — Tipos de descuento */
const CODIGO_DESCUENTO = {
  '01': 'Descuento por Regalía',
  '02': 'Descuento por Regalía o Bonificación. IVA Cobrado al Cliente',
  '03': 'Descuento por Bonificación',
  '04': 'Descuento por volumen',
  '05': 'Descuento por Temporada (estacional)',
  '06': 'Descuento promocional',
  '07': 'Descuento Comercial',
  '08': 'Descuento por frecuencia',
  '09': 'Descuento sostenido',
  '99': 'Otros descuentos',
};

/** Nota 21 — IVA cobrado a nivel de fábrica */
const IVA_FABRICA = {
  '01': 'Venta de bienes con IVA según el sistema especial a nivel de fábrica',
  '02': 'Ventas exentas según el sistema especial a nivel de fábrica, mayorista y aduanas',
};

/** Nota 22 — Tipo de transacción */
const TIPO_TRANSACCION = {
  '01': 'Venta Normal de Bienes y Servicios',
  '02': 'Mercancía de Autoconsumo exento',
  '03': 'Mercancía de Autoconsumo gravado',
  '04': 'Servicio de Autoconsumo exento',
  '05': 'Servicio de Autoconsumo gravado',
  '06': 'Cuota de afiliación',
  '07': 'Cuota de afiliación Exenta',
  '08': 'Bienes de Capital para el emisor',
  '09': 'Bienes de Capital para el receptor',
  '10': 'Bienes de Capital para el emisor y el receptor',
  '11': 'Bienes de capital de autoconsumo exento para el emisor',
  '12': 'Bienes de capital sin contraprestación a terceros exento para el emisor',
  '13': 'Sin contraprestación a terceros',
};

/** Nota 23 — Institución que emitió la exoneración */
const INSTITUCION_EXONERACION = {
  '01': 'Ministerio de Hacienda',
  '02': 'Ministerio de Relaciones Exteriores y Culto',
  '03': 'Ministerio de Agricultura y Ganadería',
  '04': 'Ministerio de Economía, Industria y Comercio',
  '05': 'Cruz Roja Costarricense',
  '06': 'Benemérito Cuerpo de Bomberos de Costa Rica',
  '07': 'Asociación Obras del Espíritu Santo',
  '08': 'Federación Cruzada Nacional de protección al Anciano (Fecrunapa)',
  '09': 'Escuela de Agricultura de la Región Húmeda (EARTH)',
  '10': 'Instituto Centroamericano de Administración de Empresas (INCAE)',
  '11': 'Junta de Protección Social (JPS)',
  '12': 'Autoridad Reguladora de los Servicios Públicos (Aresep)',
  '99': 'Otros',
};

/** Nota 3 — Código de tipo de comprobante (posiciones 9-10 del consecutivo) */
const CODIGO_TIPO_COMPROBANTE = {
  FE: '01',
  ND: '02',
  NC: '03',
  TE: '04',
  ACEPTACION: '05',
  ACEPTACION_PARCIAL: '06',
  RECHAZO: '07',
  FEC: '08',
  FEE: '09',
  REP: '10',
};

/** Nota 3 — Situación del comprobante (posición 42 de la clave) */
const SITUACION_COMPROBANTE = {
  1: 'Normal',
  2: 'Contingencia',
  3: 'Sin internet',
};

// -----------------------------------------------------------------------------

const CATALOGOS = {
  4: TIPO_IDENTIFICACION,
  5: CONDICION_VENTA,
  6: MEDIO_PAGO,
  8: CODIGO_IMPUESTO,
  8.1: TARIFA_IVA,
  9: CODIGO_REFERENCIA,
  10: TIPO_DOC_REFERENCIA,
  10.1: TIPO_DOC_EXONERACION,
  12: TIPO_CODIGO_COMERCIAL,
  15: UNIDAD_MEDIDA,
  16: TIPO_DOC_OTROS_CARGOS,
  20: CODIGO_DESCUENTO,
  21: IVA_FABRICA,
  22: TIPO_TRANSACCION,
  23: INSTITUCION_EXONERACION,
};

/** ¿Existe este código en el catálogo de la nota indicada? */
function esCodigoValido(nota, codigo) {
  const cat = CATALOGOS[nota];
  if (!cat) return true; // catálogo externo: no validable localmente
  return Object.prototype.hasOwnProperty.call(cat, codigo);
}

/**
 * Descripción legible de un código. Es lo que el renderer imprime en el PDF
 * (nota 7 del anexo). Si el código no existe, devuelve el código crudo para no
 * romper el render.
 */
function describir(nota, codigo) {
  const cat = CATALOGOS[nota];
  if (!cat) return codigo;
  const entrada = cat[codigo];
  if (entrada == null) return codigo;
  return typeof entrada === 'string' ? entrada : entrada.descripcion;
}

/** Opciones para dropdowns del editor: [{ codigo, descripcion }] */
function opciones(nota) {
  const cat = CATALOGOS[nota] || {};
  return Object.entries(cat).map(([codigo, v]) => ({
    codigo,
    descripcion: typeof v === 'string' ? v : v.descripcion,
  }));
}

module.exports = {
  CATALOGOS,
  TIPO_IDENTIFICACION,
  RELLENO_CEDULA_CLAVE,
  CONDICION_VENTA,
  CONDICIONES_CREDITO,
  MEDIO_PAGO,
  CODIGO_IMPUESTO,
  TARIFA_IVA,
  CODIGO_REFERENCIA,
  TIPO_DOC_REFERENCIA,
  TIPO_DOC_EXONERACION,
  TIPO_CODIGO_COMERCIAL,
  UNIDAD_MEDIDA,
  TIPO_DOC_OTROS_CARGOS,
  OTROS_CARGOS_SIN_DETALLE,
  CODIGO_DESCUENTO,
  IVA_FABRICA,
  TIPO_TRANSACCION,
  INSTITUCION_EXONERACION,
  CODIGO_TIPO_COMPROBANTE,
  SITUACION_COMPROBANTE,
  esCodigoValido,
  describir,
  opciones,
};
