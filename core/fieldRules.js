/**
 * fieldRules.js
 * -----------------------------------------------------------------------------
 * Matriz de campos del "Anexos y Estructuras para la Emisión de Comprobantes
 * Electrónicos v4.4" (DGT, noviembre 2024) expresada como DATOS, no como código.
 *
 * Un solo validador genérico recorre esta tabla. Si mañana Hacienda publica la
 * v4.5, se edita esta tabla y no se toca la lógica.
 *
 * CONDICIONES (según el anexo, sección "Condición de los campos"):
 *   1 = Obligatorio   siempre debe estar
 *   2 = Condicional   obligatorio si se cumple cierta circunstancia
 *   3 = Opcional      si el emisor lo desea
 *   4 = Inexistente   NO debe usarse (se rechaza si viene)
 *
 * El string `cond` tiene 7 posiciones, en este orden fijo:
 *   FE  FEE  FEC  TE  NC  ND  REP
 *
 * TIPOS: string | integer | positiveInteger | decimal | dateTime | complex
 *
 * Campos por definición de cada entrada:
 *   path   ruta canónica en el JSON (notación de puntos; [] = array)
 *   tag    etiqueta XML oficial (se conserva aunque hoy no generemos XML,
 *          porque es la llave para mapear a v4.4 cuando toque)
 *   tipo   tipo de dato
 *   max    tamaño máximo (para decimal: "enteros,decimales")
 *   min    largo mínimo cuando el anexo lo especifica
 *   rep    repeticiones permitidas [min, max]
 *   nota   número de nota del anexo que define el catálogo aplicable
 *   cond   los 7 dígitos de condición
 *
 * NOTA DE ALCANCE: el nodo DetalleSurtido (combos/paquetes, hasta 20 líneas
 * anidadas con su propio bloque de impuestos) se declara como complex pero no
 * se desglosa aquí. Aplica solo a fabricantes e importadores que facturan
 * surtidos con distintas tarifas de IVA — fuera del alcance de este servicio.
 * -----------------------------------------------------------------------------
 */

'use strict';

const TIPOS_COMPROBANTE = ['FE', 'FEE', 'FEC', 'TE', 'NC', 'ND', 'REP'];

const CONDICION = {
  OBLIGATORIO: 1,
  CONDICIONAL: 2,
  OPCIONAL: 3,
  INEXISTENTE: 4,
};

// =============================================================================
// a) DATOS DEL ENCABEZADO
// =============================================================================

const ENCABEZADO = [
  // --- identificación del documento -----------------------------------------
  { path: 'clave',                tag: 'Clave',                 tipo: 'string',   max: 50, min: 50, cond: '1111111',
    regla: 'numerico', notas: [1, 3, 4.1] },
  { path: 'proveedorSistemas',    tag: 'ProveedorSistemas',      tipo: 'string',   max: 20, cond: '1111111',
    ayuda: 'Cédula del proveedor del software. En desarrollo propio, la del propio obligado tributario.' },
  { path: 'codigoActividadEmisor',   tag: 'CodigoActividadEmisor',   tipo: 'string', max: 6, cond: '1131224' },
  { path: 'codigoActividadReceptor', tag: 'CodigoActividadReceptor', tipo: 'string', max: 6, cond: '2414224',
    ayuda: 'En FE hoy es condicional; Hacienda comunicará cuándo pasa a obligatorio.' },
  { path: 'numeroConsecutivo',    tag: 'NumeroConsecutivo',      tipo: 'string',   max: 20, min: 20, cond: '1111111',
    regla: 'numerico', notas: [1, 3] },
  { path: 'fechaEmision',         tag: 'FechaEmision',           tipo: 'dateTime', cond: '1111111',
    ayuda: 'RFC3339. No se permiten fechas futuras ni anteriores, salvo situación "sin internet".' },

  // --- emisor ---------------------------------------------------------------
  { path: 'emisor',                          tag: 'Emisor',            tipo: 'complex', cond: '1111111' },
  { path: 'emisor.nombre',                   tag: 'Nombre',            tipo: 'string', max: 100, min: 5, cond: '1111111' },
  { path: 'emisor.identificacion',           tag: 'Identificacion',    tipo: 'complex', cond: '1111111' },
  { path: 'emisor.identificacion.tipo',      tag: 'Tipo',              tipo: 'string', max: 2, min: 2, nota: 4, cond: '1111111' },
  { path: 'emisor.identificacion.numero',    tag: 'Numero',            tipo: 'string', max: 20, cond: '1111111',
    regla: 'cedula' },
  { path: 'emisor.registroFiscal8707',       tag: 'Registrofiscal8707', tipo: 'string', max: 12, cond: '2222224',
    ayuda: 'Obligatorio al facturar CAByS de bebidas alcohólicas (Ley 8707).' },
  { path: 'emisor.nombreComercial',          tag: 'NombreComercial',   tipo: 'string', max: 80, min: 3, cond: '3333334' },

  { path: 'emisor.ubicacion',                tag: 'Ubicacion',         tipo: 'complex', cond: '1121224' },
  { path: 'emisor.ubicacion.provincia',      tag: 'Provincia',         tipo: 'string', max: 1, nota: 14, cond: '1111114', regla: 'numerico' },
  { path: 'emisor.ubicacion.canton',         tag: 'Canton',            tipo: 'string', max: 2, nota: 14, cond: '1111114', regla: 'numerico' },
  { path: 'emisor.ubicacion.distrito',       tag: 'Distrito',          tipo: 'string', max: 2, nota: 14, cond: '1111114', regla: 'numerico' },
  { path: 'emisor.ubicacion.barrio',         tag: 'Barrio',            tipo: 'string', max: 50, min: 5, cond: '3333224' },
  { path: 'emisor.ubicacion.otrasSenas',     tag: 'OtrasSenas',        tipo: 'string', max: 250, min: 5, cond: '1111114' },
  { path: 'emisor.otrasSenasExtranjero',     tag: 'OtrasSenasExtranjero', tipo: 'string', max: 300, min: 5, cond: '4424444' },

  { path: 'emisor.telefono',                 tag: 'Telefono',          tipo: 'complex', cond: '3333334' },
  { path: 'emisor.telefono.codigoPais',      tag: 'CodigoPais',        tipo: 'integer', max: 3, min: 1, cond: '1111114' },
  { path: 'emisor.telefono.numTelefono',     tag: 'NumTelefono',       tipo: 'integer', max: 20, min: 8, cond: '1111114' },
  { path: 'emisor.correoElectronico',        tag: 'CorreoElectronico', tipo: 'string', max: 160, rep: [1, 4], cond: '1121221',
    regla: 'email' },

  // --- receptor -------------------------------------------------------------
  { path: 'receptor',                        tag: 'Receptor',          tipo: 'complex', cond: '1212221' },
  { path: 'receptor.nombre',                 tag: 'Nombre',            tipo: 'string', max: 100, min: 3, cond: '1111111' },
  { path: 'receptor.identificacion',         tag: 'Identificacion',    tipo: 'complex', cond: '1112221' },
  { path: 'receptor.identificacion.tipo',    tag: 'Tipo',              tipo: 'string', max: 2, min: 2, nota: 4, cond: '1111111' },
  { path: 'receptor.identificacion.numero',  tag: 'Numero',            tipo: 'string', max: 20, cond: '1111111', regla: 'cedula' },
  { path: 'receptor.nombreComercial',        tag: 'NombreComercial',   tipo: 'string', max: 80, min: 3, cond: '3333334' },

  { path: 'receptor.ubicacion',              tag: 'Ubicacion',         tipo: 'complex', cond: '2423224' },
  { path: 'receptor.ubicacion.provincia',    tag: 'Provincia',         tipo: 'string', max: 1, nota: 14, cond: '1411114', regla: 'numerico' },
  { path: 'receptor.ubicacion.canton',       tag: 'Canton',            tipo: 'string', max: 2, nota: 14, cond: '1411114', regla: 'numerico' },
  { path: 'receptor.ubicacion.distrito',     tag: 'Distrito',          tipo: 'string', max: 2, nota: 14, cond: '1411114', regla: 'numerico' },
  { path: 'receptor.ubicacion.barrio',       tag: 'Barrio',            tipo: 'string', max: 50, min: 5, cond: '3432224' },
  { path: 'receptor.ubicacion.otrasSenas',   tag: 'OtrasSenas',        tipo: 'string', max: 160, min: 5, cond: '1411114' },
  { path: 'receptor.otrasSenasExtranjero',   tag: 'OtrasSenasExtranjero', tipo: 'string', max: 300, min: 5, cond: '2243224' },

  { path: 'receptor.telefono',               tag: 'Telefono',          tipo: 'complex', cond: '3333334' },
  { path: 'receptor.telefono.codigoPais',    tag: 'CodigoPais',        tipo: 'integer', max: 3, min: 1, cond: '1111114' },
  { path: 'receptor.telefono.numTelefono',   tag: 'NumTelefono',       tipo: 'integer', max: 20, min: 8, cond: '1111114' },
  { path: 'receptor.correoElectronico',      tag: 'CorreoElectronico', tipo: 'string', max: 160, cond: '2222222', regla: 'email' },

  // --- condiciones de la venta ----------------------------------------------
  { path: 'condicionVenta',        tag: 'CondicionVenta',       tipo: 'string',  max: 2, min: 2, nota: 5, cond: '1111111' },
  { path: 'condicionVentaOtros',   tag: 'CondicionVentaOtros',  tipo: 'string',  max: 100, min: 5, cond: '2222224',
    requeridoSi: { campo: 'condicionVenta', valor: '99' } },
  { path: 'plazoCredito',          tag: 'PlazoCredito',         tipo: 'integer', max: 5, cond: '2222224',
    requeridoSi: { campo: 'condicionVenta', valorEn: ['02', '10'] },
    ayuda: 'En días, mayor a cero. Si la condición es crédito y va en 0, Hacienda rechaza.' },
];

// =============================================================================
// b) DETALLE DE LA MERCANCÍA O SERVICIO PRESTADO
// =============================================================================

const DETALLE = [
  { path: 'detalleServicio', tag: 'DetalleServicio', tipo: 'complex', cond: '2112221',
    ayuda: 'No obligatorio en FE/TE/NC/ND cuando se usa OtrosCargos con tipo 04, 08, 09 o 10 (nota 16) y no hay línea de producto. Este es el caso de una multa.' },

  { path: 'detalleServicio.lineaDetalle', tag: 'LineaDetalle', tipo: 'complex', rep: [1, 1000], cond: '1111111' },

  { path: 'detalleServicio.lineaDetalle[].numeroLinea',        tag: 'NumeroLinea',        tipo: 'positiveInteger', cond: '1111111' },
  { path: 'detalleServicio.lineaDetalle[].partidaArancelaria', tag: 'PartidaArancelaria', tipo: 'string', max: 12, min: 12, cond: '4244224' },
  { path: 'detalleServicio.lineaDetalle[].codigoCabys',        tag: 'CodigoCABYS',        tipo: 'string', max: 13, nota: 17, cond: '1111224' },

  { path: 'detalleServicio.lineaDetalle[].codigoComercial',        tag: 'CodigoComercial', tipo: 'complex', rep: [0, 5], cond: '2222224' },
  { path: 'detalleServicio.lineaDetalle[].codigoComercial[].tipo', tag: 'Tipo',   tipo: 'string', max: 2, min: 2, nota: 12, cond: '1111114' },
  { path: 'detalleServicio.lineaDetalle[].codigoComercial[].codigo', tag: 'Codigo', tipo: 'string', max: 20, min: 3, cond: '1111114' },

  { path: 'detalleServicio.lineaDetalle[].cantidad',               tag: 'Cantidad',              tipo: 'decimal', max: '16,3', cond: '1111114', regla: 'mayorACero' },
  { path: 'detalleServicio.lineaDetalle[].unidadMedida',           tag: 'UnidadMedida',          tipo: 'string', max: 15, nota: 15, cond: '1111114' },
  { path: 'detalleServicio.lineaDetalle[].tipoTransaccion',        tag: 'TipoTransaccion',       tipo: 'string', max: 2, nota: 22, cond: '2224224' },
  { path: 'detalleServicio.lineaDetalle[].unidadMedidaComercial',  tag: 'UnidadMedidaComercial', tipo: 'string', max: 20, cond: '3333334' },
  { path: 'detalleServicio.lineaDetalle[].detalle',                tag: 'Detalle',               tipo: 'string', max: 200, min: 3, cond: '1111111' },
  { path: 'detalleServicio.lineaDetalle[].numeroVINoSerie',        tag: 'NumeroVINoSerie',       tipo: 'string', max: 17, cond: '2222224' },
  { path: 'detalleServicio.lineaDetalle[].registroMedicamento',    tag: 'RegistroMedicamento',   tipo: 'string', max: 100, cond: '2222224' },
  { path: 'detalleServicio.lineaDetalle[].formaFarmaceutica',      tag: 'FormaFarmaceutica',     tipo: 'string', max: 3, nota: 19, cond: '2222224' },
  { path: 'detalleServicio.lineaDetalle[].detalleSurtido',         tag: 'DetalleSurtido',        tipo: 'complex', rep: [1, 20], cond: '2242224',
    ayuda: 'Fuera de alcance en esta implementación. Solo aplica a surtidos con tarifas de IVA mixtas.' },

  { path: 'detalleServicio.lineaDetalle[].precioUnitario', tag: 'PrecioUnitario', tipo: 'decimal', max: '18,5', cond: '1111114', regla: 'mayorACero' },
  { path: 'detalleServicio.lineaDetalle[].montoTotal',     tag: 'MontoTotal',     tipo: 'decimal', max: '18,5', cond: '1111111',
    calculo: 'cantidad * precioUnitario' },

  { path: 'detalleServicio.lineaDetalle[].descuento',                       tag: 'Descuento',           tipo: 'complex', rep: [0, 5], cond: '3333224' },
  { path: 'detalleServicio.lineaDetalle[].descuento[].montoDescuento',      tag: 'MontoDescuento',      tipo: 'decimal', max: '18,5', cond: '1111114' },
  { path: 'detalleServicio.lineaDetalle[].descuento[].codigoDescuento',     tag: 'CodigoDescuento',     tipo: 'string', max: 2, nota: 20, cond: '1111114' },
  { path: 'detalleServicio.lineaDetalle[].descuento[].codigoDescuentoOtro', tag: 'CodigoDescuentoOTRO', tipo: 'string', max: 100, min: 5, cond: '2222224' },
  { path: 'detalleServicio.lineaDetalle[].descuento[].naturalezaDescuento', tag: 'NaturalezaDescuento', tipo: 'string', max: 80, min: 3, cond: '2222224',
    requeridoSi: { campo: 'codigoDescuento', valor: '99' } },

  { path: 'detalleServicio.lineaDetalle[].subTotal',           tag: 'SubTotal',           tipo: 'decimal', max: '18,5', cond: '1111111',
    calculo: 'montoTotal - sum(descuento[].montoDescuento)' },
  { path: 'detalleServicio.lineaDetalle[].ivaCobradoFabrica',  tag: 'IVACobradoFabrica',  tipo: 'string', max: 2, nota: 21, cond: '2442224' },
  { path: 'detalleServicio.lineaDetalle[].baseImponible',      tag: 'BaseImponible',      tipo: 'decimal', max: '18,5', cond: '1411114',
    calculo: 'subTotal + impuestos específicos 02, 04, 05, 12 cuando apliquen' },

  // --- impuestos por línea ---------------------------------------------------
  { path: 'detalleServicio.lineaDetalle[].impuesto',                      tag: 'Impuesto',            tipo: 'complex', rep: [1, 1000], cond: '1111112' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].codigo',             tag: 'Codigo',              tipo: 'string', max: 2, min: 2, nota: 8, cond: '1111111' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].codigoImpuestoOtro', tag: 'CodigoImpuestoOTRO',  tipo: 'string', max: 100, min: 5, cond: '2222222',
    requeridoSi: { campo: 'codigo', valor: '99' } },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].codigoTarifaIva',    tag: 'CodigoTarifaIVA',     tipo: 'string', max: 2, min: 2, nota: 8.1, cond: '2222222',
    requeridoSi: { campo: 'codigo', valorEn: ['01', '07'] } },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].tarifa',             tag: 'Tarifa',              tipo: 'decimal', max: '4,2', cond: '2222222',
    ayuda: 'Porcentaje como número: 13% => 13; 0.5% => 0.5' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].factorCalculoIva',   tag: 'FactorCalculoIVA',    tipo: 'decimal', max: '5,4', cond: '2222222',
    requeridoSi: { campo: 'codigo', valor: '08' } },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].datosImpuestoEspecifico', tag: 'DatosImpuestoEspecifico', tipo: 'complex', cond: '2442224',
    requeridoSi: { campo: 'codigo', valorEn: ['03', '04', '05', '06'] } },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].datosImpuestoEspecifico.cantidadUnidadMedida', tag: 'CantidadUnidadMedida', tipo: 'decimal', max: '7,2',  cond: '1441114' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].datosImpuestoEspecifico.porcentaje',           tag: 'Porcentaje',           tipo: 'decimal', max: '4,2',  cond: '2442224' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].datosImpuestoEspecifico.proporcion',           tag: 'Proporcion',           tipo: 'decimal', max: '5,2',  cond: '2442224' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].datosImpuestoEspecifico.volumenUnidadConsumo', tag: 'VolumenUnidadConsumo', tipo: 'decimal', max: '7,2',  cond: '2442224' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].datosImpuestoEspecifico.impuestoUnidad',       tag: 'ImpuestoUnidad',       tipo: 'decimal', max: '18,5', cond: '1441114' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].monto',           tag: 'Monto',           tipo: 'decimal', max: '18,5', cond: '1111111',
    calculo: 'IVA general: tarifa * baseImponible' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].montoExportacion', tag: 'MontoExportacion', tipo: 'decimal', max: '18,5', cond: '4244224' },

  // --- exoneración -----------------------------------------------------------
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion',                        tag: 'Exoneracion',            tipo: 'complex', cond: '2422224' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.tipoDocumentoEx',        tag: 'TipoDocumentoEX',        tipo: 'string', max: 2, min: 2, nota: 10.1, cond: '1411114' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.tipoDocumentoOtro',      tag: 'TipoDocumentoOTRO',      tipo: 'string', max: 100, min: 5, cond: '2422224' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.numeroDocumento',        tag: 'NumeroDocumento',        tipo: 'string', max: 40, min: 3, cond: '1411114' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.articulo',               tag: 'Articulo',               tipo: 'integer', max: 6, cond: '2422224' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.inciso',                 tag: 'Inciso',                 tipo: 'integer', max: 6, cond: '2422224' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.nombreInstitucion',      tag: 'NombreInstitucion',      tipo: 'string', max: 2, nota: 23, cond: '1411114' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.nombreInstitucionOtros', tag: 'NombreInstitucionOtros', tipo: 'string', max: 160, min: 5, cond: '2422224' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.fechaEmisionEx',         tag: 'FechaEmisionEX',         tipo: 'dateTime', cond: '1411114' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.tarifaExonerada',        tag: 'TarifaExonerada',        tipo: 'decimal', max: '4,2', cond: '1411114' },
  { path: 'detalleServicio.lineaDetalle[].impuesto[].exoneracion.montoExoneracion',       tag: 'MontoExoneracion',       tipo: 'decimal', max: '18,5', cond: '1411114',
    calculo: 'tarifaExonerada * subTotal (o baseImponible si existe)' },

  { path: 'detalleServicio.lineaDetalle[].impuestoAsumidoEmisorFabrica', tag: 'ImpuestoAsumidoEmisorFabrica', tipo: 'decimal', max: '18,5', cond: '1441224',
    ayuda: 'Si no aplica, se envía 0 explícitamente. No omitir.' },
  { path: 'detalleServicio.lineaDetalle[].impuestoNeto',    tag: 'ImpuestoNeto',    tipo: 'decimal', max: '18,5', cond: '1411111',
    calculo: 'monto - montoExoneracion - impuestoAsumidoEmisorFabrica' },
  { path: 'detalleServicio.lineaDetalle[].montoTotalLinea', tag: 'MontoTotalLinea', tipo: 'decimal', max: '18,5', cond: '1111111',
    calculo: 'subTotal + impuestoNeto' },

  // --- otros cargos (aquí vive la MULTA, nota 16 código 09) ------------------
  { path: 'otrosCargos',                          tag: 'OtrosCargos',         tipo: 'complex', rep: [0, 15], cond: '2222224' },
  { path: 'otrosCargos[].tipoDocumentoOc',        tag: 'TipoDocumentoOC',     tipo: 'string', max: 2, nota: 16, cond: '1111114' },
  { path: 'otrosCargos[].tipoDocumentoOtros',     tag: 'TipoDocumentoOTROS',  tipo: 'string', max: 100, min: 5, cond: '2222224',
    requeridoSi: { campo: 'tipoDocumentoOc', valor: '99' } },
  { path: 'otrosCargos[].identificacionTercero',        tag: 'IdentificacionTercero', tipo: 'complex', cond: '2222224',
    requeridoSi: { campo: 'tipoDocumentoOc', valor: '04' } },
  { path: 'otrosCargos[].identificacionTercero.tipo',   tag: 'Tipo',   tipo: 'string', max: 2, nota: 4, cond: '1111114' },
  { path: 'otrosCargos[].identificacionTercero.numero', tag: 'Numero', tipo: 'string', max: 20, cond: '1111114', regla: 'cedula' },
  { path: 'otrosCargos[].nombreTercero',          tag: 'NombreTercero',       tipo: 'string', max: 100, min: 5, cond: '2422224' },
  { path: 'otrosCargos[].detalle',                tag: 'Detalle',             tipo: 'string', max: 160, cond: '1111114' },
  { path: 'otrosCargos[].porcentajeOc',           tag: 'PorcentajeOC',        tipo: 'decimal', max: '9,5', cond: '2222224' },
  { path: 'otrosCargos[].montoCargo',             tag: 'MontoCargo',          tipo: 'decimal', max: '18,5', cond: '1111114', regla: 'mayorACero' },
];

// =============================================================================
// c) RESUMEN DEL COMPROBANTE
// =============================================================================

const RESUMEN = [
  { path: 'resumen',                          tag: 'ResumenFactura',    tipo: 'complex', cond: '1111111' },
  { path: 'resumen.codigoTipoMoneda',         tag: 'CodigoTipoMoneda',  tipo: 'complex', cond: '1111111' },
  { path: 'resumen.codigoTipoMoneda.codigoMoneda', tag: 'CodigoMoneda', tipo: 'string', max: 3, nota: 13.1, cond: '1111111' },
  { path: 'resumen.codigoTipoMoneda.tipoCambio',   tag: 'TipoCambio',   tipo: 'decimal', max: '18,5', cond: '1111111',
    ayuda: 'Si la moneda es CRC, este campo debe ser exactamente 1 o Hacienda rechaza.' },

  { path: 'resumen.totalServGravados',      tag: 'TotalServGravados',      tipo: 'decimal', max: '18,5', cond: '2222224' },
  { path: 'resumen.totalServExentos',       tag: 'TotalServExentos',       tipo: 'decimal', max: '18,5', cond: '2222224' },
  { path: 'resumen.totalServExonerado',     tag: 'TotalServExonerado',     tipo: 'decimal', max: '18,5', cond: '2422224' },
  { path: 'resumen.totalServNoSujeto',      tag: 'TotalServNoSujeto',      tipo: 'decimal', max: '18,5', cond: '2422224' },
  { path: 'resumen.totalMercanciasGravadas', tag: 'TotalMercanciasGravadas', tipo: 'decimal', max: '18,5', cond: '2222224' },
  { path: 'resumen.totalMercanciasExentas', tag: 'TotalMercanciasExentas', tipo: 'decimal', max: '18,5', cond: '2222224' },
  { path: 'resumen.totalMercExonerada',     tag: 'TotalMercExonerada',     tipo: 'decimal', max: '18,5', cond: '2422224' },
  { path: 'resumen.totalMercNoSujeta',      tag: 'TotalMercNoSujeta',      tipo: 'decimal', max: '18,5', cond: '2422224' },

  { path: 'resumen.totalGravado',    tag: 'TotalGravado',    tipo: 'decimal', max: '18,5', cond: '2222224', calculo: 'totalServGravados + totalMercanciasGravadas' },
  { path: 'resumen.totalExento',     tag: 'TotalExento',     tipo: 'decimal', max: '18,5', cond: '2222224', calculo: 'totalServExentos + totalMercanciasExentas' },
  { path: 'resumen.totalExonerado',  tag: 'TotalExonerado',  tipo: 'decimal', max: '18,5', cond: '2422224', calculo: 'totalServExonerado + totalMercExonerada' },
  { path: 'resumen.totalNoSujeto',   tag: 'TotalNoSujeto',   tipo: 'decimal', max: '18,5', cond: '2422224', calculo: 'totalServNoSujeto + totalMercNoSujeta' },
  { path: 'resumen.totalVenta',      tag: 'TotalVenta',      tipo: 'decimal', max: '18,5', cond: '1111111', calculo: 'totalGravado + totalExento + totalExonerado + totalNoSujeto' },
  { path: 'resumen.totalDescuentos', tag: 'TotalDescuentos', tipo: 'decimal', max: '18,5', cond: '2222224', calculo: 'suma de todos los montoDescuento' },
  { path: 'resumen.totalVentaNeta',  tag: 'TotalVentaNeta',  tipo: 'decimal', max: '18,5', cond: '1111111', calculo: 'totalVenta - totalDescuentos' },

  { path: 'resumen.totalDesgloseImpuesto',                      tag: 'TotalDesgloseImpuesto', tipo: 'complex', rep: [1, 1000], cond: '2222222' },
  { path: 'resumen.totalDesgloseImpuesto[].codigo',             tag: 'Codigo',              tipo: 'string', max: 2, nota: 8, cond: '1111111' },
  { path: 'resumen.totalDesgloseImpuesto[].codigoTarifaIva',    tag: 'CodigoTarifaIVA',     tipo: 'string', max: 2, nota: 8.1, cond: '2222222' },
  { path: 'resumen.totalDesgloseImpuesto[].totalMontoImpuesto', tag: 'TotalMontoImpuesto',  tipo: 'decimal', max: '18,5', cond: '1111111' },

  { path: 'resumen.totalImpuesto',              tag: 'TotalImpuesto',              tipo: 'decimal', max: '18,5', cond: '2222222' },
  { path: 'resumen.totalImpAsumEmisorFabrica',  tag: 'TotalImpAsumEmisorFabrica',  tipo: 'decimal', max: '18,5', cond: '2222224' },
  { path: 'resumen.totalIvaDevuelto',           tag: 'TotalIVADevuelto',           tipo: 'decimal', max: '18,5', cond: '2442224',
    ayuda: 'Solo servicios de salud pagados con tarjeta.' },
  { path: 'resumen.totalOtrosCargos',           tag: 'TotalOtrosCargos',           tipo: 'decimal', max: '18,5', cond: '2222224', calculo: 'suma de montoCargo' },

  { path: 'resumen.medioPago',                    tag: 'MedioPago',       tipo: 'complex', rep: [1, 4], cond: '2222221',
    ayuda: 'Obligatorio salvo condiciones de venta 02, 08 y 10 (crédito). En v4.4 este nodo vive en el resumen, no en el encabezado.' },
  { path: 'resumen.medioPago[].tipoMedioPago',    tag: 'TipoMedioPago',   tipo: 'string', max: 2, min: 2, nota: 6, cond: '2222221' },
  { path: 'resumen.medioPago[].medioPagoOtros',   tag: 'MedioPagoOtros',  tipo: 'string', max: 100, min: 3, cond: '2222222',
    requeridoSi: { campo: 'tipoMedioPago', valor: '99' } },
  { path: 'resumen.medioPago[].totalMedioPago',   tag: 'TotalMedioPago',  tipo: 'decimal', max: '18,5', cond: '2222222', regla: 'mayorACero' },

  { path: 'resumen.totalComprobante', tag: 'TotalComprobante', tipo: 'decimal', max: '18,5', cond: '1111111',
    calculo: 'totalVentaNeta + totalImpuesto + totalOtrosCargos - totalIvaDevuelto; debe coincidir con la suma de totalMedioPago' },
];

// =============================================================================
// d) INFORMACIÓN DE REFERENCIA
// =============================================================================

const REFERENCIA = [
  { path: 'informacionReferencia',                         tag: 'InformacionReferencia', tipo: 'complex', rep: [0, 10], cond: '2313111' },
  { path: 'informacionReferencia[].tipoDocIr',             tag: 'TipoDocIR',             tipo: 'string', max: 2, min: 2, nota: 10, cond: '1111111' },
  { path: 'informacionReferencia[].tipoDocRefOtro',        tag: 'TipoDocRefOTRO',        tipo: 'string', max: 100, min: 5, cond: '2222222',
    requeridoSi: { campo: 'tipoDocIr', valor: '99' } },
  { path: 'informacionReferencia[].numero',                tag: 'Numero',                tipo: 'string', max: 50, cond: '2222221' },
  { path: 'informacionReferencia[].fechaEmisionIr',        tag: 'FechaEmisionIR',        tipo: 'dateTime', cond: '1111111',
    ayuda: 'No puede superar 10 años de antigüedad.' },
  { path: 'informacionReferencia[].codigo',                tag: 'Codigo',                tipo: 'string', max: 2, min: 2, nota: 9, cond: '2222222' },
  { path: 'informacionReferencia[].codigoReferenciaOtro',  tag: 'CodigoReferenciaOTRO',  tipo: 'string', max: 100, min: 5, cond: '2222222',
    requeridoSi: { campo: 'codigo', valor: '99' } },
  { path: 'informacionReferencia[].razon',                 tag: 'Razon',                 tipo: 'string', max: 180, min: 3, cond: '2222222' },
];

// =============================================================================
// e) OTROS — uso comercial, NO tributario
//    Aquí van los datos propios del negocio del cliente (partido, árbitro,
//    temporada). Es el escape hatch legítimo del anexo y lo que el editor de
//    plantillas expone como "campos personalizados".
// =============================================================================

const OTROS = [
  { path: 'otros',                 tag: 'Otros',          tipo: 'complex', cond: '3333334' },
  { path: 'otros.otroTexto[]',     tag: 'OtroTexto',      tipo: 'string', max: 500, rep: [0, Infinity], cond: '3333334' },
  { path: 'otros.otroContenido[]', tag: 'OtroContenido',  tipo: 'string', max: 500, rep: [0, Infinity], cond: '3333334' },
];

// =============================================================================
// Índice y utilidades de consulta
// =============================================================================

const CAMPOS = [...ENCABEZADO, ...DETALLE, ...RESUMEN, ...REFERENCIA, ...OTROS];

const INDICE = new Map(CAMPOS.map((c) => [c.path, c]));

/** Devuelve la condición (1-4) de un campo para un tipo de comprobante dado. */
function condicionDe(path, tipoComprobante) {
  const campo = INDICE.get(path);
  if (!campo) throw new Error(`Campo desconocido en la matriz v4.4: ${path}`);
  const i = TIPOS_COMPROBANTE.indexOf(tipoComprobante);
  if (i === -1) throw new Error(`Tipo de comprobante inválido: ${tipoComprobante}`);
  return Number(campo.cond[i]);
}

/** Todos los campos que aplican a un tipo de comprobante (excluye inexistentes). */
function camposDe(tipoComprobante) {
  const i = TIPOS_COMPROBANTE.indexOf(tipoComprobante);
  if (i === -1) throw new Error(`Tipo de comprobante inválido: ${tipoComprobante}`);
  return CAMPOS.filter((c) => c.cond[i] !== '4');
}

/** Campos obligatorios de un tipo — útil para generar formularios y tests. */
function obligatoriosDe(tipoComprobante) {
  const i = TIPOS_COMPROBANTE.indexOf(tipoComprobante);
  return CAMPOS.filter((c) => c.cond[i] === '1');
}

module.exports = {
  TIPOS_COMPROBANTE,
  CONDICION,
  CAMPOS,
  INDICE,
  ENCABEZADO,
  DETALLE,
  RESUMEN,
  REFERENCIA,
  OTROS,
  condicionDe,
  camposDe,
  obligatoriosDe,
};
