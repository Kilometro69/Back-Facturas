/**
 * emision.js — Servicio de emisión de comprobantes
 * -----------------------------------------------------------------------------
 * Orquesta el camino completo:
 *
 *   entrada -> adaptador -> completar datos del emisor -> validar
 *           -> numerar -> renderizar -> PDF -> Mongo -> guardar
 *
 * No hay paso de cálculo: los montos llegan resueltos desde el cliente. La
 * plataforma valida la estructura contra el anexo v4.4 y emite.
 *
 * El orden importa. Se valida ANTES de consumir un número de consecutivo:
 * si un comprobante inválido quemara un número, quedarían huecos en la
 * secuencia, y el anexo exige que sea continua.
 * -----------------------------------------------------------------------------
 */

'use strict';

const { Counter, Document, Template } = require('../db/models');
const { validar } = require('../../core/validador');
const ident = require('../../core/identificadores');
const { renderHtml, LAYOUT_POR_DEFECTO } = require('../render/plantilla');
const { generarPdf } = require('../render/pdf');
const { generarQr } = require('../render/qr');
const ubicaciones = require('../../core/ubicaciones');
const almacen = require('../storage/almacen');
const adaptadores = require('../adaptadores');

/**
 * Contexto de render: lo que el HTML necesita pero no vive en el comprobante.
 * El QR solo se genera si la plantilla lo pide, para no pagar el costo en cada
 * emisión de quien no lo usa.
 */
async function contextoRender(doc, plantilla, tipoComprobante, extra = {}) {
  return {
    tipoComprobante,
    nombresUbicacionEmisor: ubicaciones.resolver(doc.emisor?.ubicacion),
    nombresUbicacionReceptor: ubicaciones.resolver(doc.receptor?.ubicacion),
    ...(plantilla?.layout?.mostrarQr
      ? { qrDataUri: await generarQr(doc.clave, { color: plantilla.branding?.colorTexto }) }
      : {}),
    ...extra,
  };
}

/** Error con la lista completa de problemas de validación. */
class ErrorValidacion extends Error {
  constructor(errores) {
    super('El comprobante no cumple con la estructura v4.4');
    this.name = 'ErrorValidacion';
    this.status = 422;
    this.codigo = 'VALIDATION_FAILED';
    this.errores = errores;
  }
}

// -----------------------------------------------------------------------------
// Datos del emisor ++
//
// El cliente nunca manda sus propios datos de emisor: salen del tenant. Así no
// puede emitir a nombre de otro, y no tiene que repetirlos en cada llamada.
// -----------------------------------------------------------------------------

// CODIGO_ACTIVIDAD_PENDIENTE: relleno temporal para codigoActividadEmisor, obligatorio en el
// anexo para FE. Se usa SOLO cuando el tenant no tiene codigoActividad propio (hoy en día,
// ningún tenant lo tiene: se sacó del registro a propósito, ver la nota en
// routes/panel.js sobre TenantSchema.verificacion). Mientras no exista el servicio de firma
// digital que confirme/complete este dato real, esto evita bloquear la emisión de comprobantes
// por un campo que nadie tiene forma de llenar todavía. Cuando esa integración exista, dejará de
// hacer falta: tenant.codigoActividad ya no será null y este relleno nunca se va a usar.

const CODIGO_ACTIVIDAD_PENDIENTE = '000000';

function completarEmisor(doc, tenant) {
  return {
    ...doc,
    codigoActividadEmisor: doc.codigoActividadEmisor || tenant.codigoActividad || CODIGO_ACTIVIDAD_PENDIENTE,
    proveedorSistemas: tenant.proveedorSistemas || tenant.identificacion.numero,
    emisor: {
      nombre: tenant.nombre,
      identificacion: {
        tipo: tenant.identificacion.tipo,
        numero: tenant.identificacion.numero,
      },
      ...(tenant.nombreComercial ? { nombreComercial: tenant.nombreComercial } : {}),
      ...(tenant.ubicacion?.provincia ? { ubicacion: tenant.ubicacion.toObject?.() ?? tenant.ubicacion } : {}),
      ...(tenant.telefono?.numTelefono ? { telefono: tenant.telefono.toObject?.() ?? tenant.telefono } : {}),
      ...(tenant.correos?.length ? { correoElectronico: tenant.correos } : {}),
    },
  };
}

/*function completarEmisor(doc, tenant) {
  return {
    ...doc,
    codigoActividadEmisor: doc.codigoActividadEmisor || tenant.codigoActividad,
    proveedorSistemas: tenant.proveedorSistemas || tenant.identificacion.numero,
    emisor: {
      nombre: tenant.nombre,
      identificacion: {
        tipo: tenant.identificacion.tipo,
        numero: tenant.identificacion.numero,
      },
      ...(tenant.nombreComercial ? { nombreComercial: tenant.nombreComercial } : {}),
      ...(tenant.ubicacion?.provincia ? { ubicacion: tenant.ubicacion.toObject?.() ?? tenant.ubicacion } : {}),
      ...(tenant.telefono?.numTelefono ? { telefono: tenant.telefono.toObject?.() ?? tenant.telefono } : {}),
      ...(tenant.correos?.length ? { correoElectronico: tenant.correos } : {}),
    },
  };
}*/

// -----------------------------------------------------------------------------
// Numeración
// -----------------------------------------------------------------------------

async function numerar(tenant, tipoComprobante, fechaEmision) {
  const local = tenant.local || 1;
  const terminal = tenant.terminal || 1;
  const llave = `${tenant._id}:${String(local).padStart(3, '0')}:${String(terminal).padStart(5, '0')}:${tipoComprobante}`;

  // Incremento atómico: dos peticiones simultáneas nunca reciben el mismo
  // número, que produciría claves duplicadas.
  const secuencia = await Counter.siguiente(llave);

  const consecutivo = ident.generarConsecutivo({ local, terminal, tipoComprobante, secuencia });
  const clave = ident.generarClave({
    fechaEmision,
    cedulaEmisor: tenant.identificacion.numero,
    tipoIdentificacionEmisor: tenant.identificacion.tipo,
    consecutivo,
    situacion: 1,
  });

  return { clave, consecutivo, secuencia };
}

// -----------------------------------------------------------------------------
// Plantilla
// -----------------------------------------------------------------------------

async function resolverPlantilla(tenant, plantillaId) {
  const id = plantillaId || tenant.plantillaPorDefecto;
  const plantilla = id
    ? await Template.findOne({ _id: id, tenantId: tenant._id, activa: true })
    : await Template.findOne({ tenantId: tenant._id, activa: true }).sort({ createdAt: 1 });

  if (plantilla) {
    return {
      _id: plantilla._id,
      nombre: plantilla.nombre,
      version: plantilla.version,
      branding: plantilla.branding.toObject?.() ?? plantilla.branding,
      layout: plantilla.layout.toObject?.() ?? plantilla.layout,
    };
  }

  // Sin plantilla configurada se emite igual, con el diseño base. Un tenant
  // recién creado debe poder facturar sin pasar antes por el editor.
  return {
    _id: null,
    nombre: 'Predeterminada',
    version: 0,
    branding: {},
    layout: { bloques: LAYOUT_POR_DEFECTO },
  };
}

// -----------------------------------------------------------------------------
// Emisión
// -----------------------------------------------------------------------------

/**
 * @param {object} opciones
 * @param {object} opciones.tenant     documento Tenant
 * @param {object} opciones.entrada    JSON tal como lo mandó el cliente
 * @param {string} [opciones.adaptador] nombre del adaptador a aplicar
 * @param {string} [opciones.plantillaId]
 * @returns {Promise<Document>}
 */
async function emitir({ tenant, entrada, adaptador: nombreAdaptador, plantillaId }) {
  // 1. Traducir al canónico si el cliente usa su propio formato
  let doc = entrada;
  let infoAdaptador;

  if (nombreAdaptador) {
    // Primero los adaptadores propios del tenant; si no, el catálogo público
    // de predefinidos. Un tenant nunca ve la configuración de otro.
    const config = (tenant.adaptadores || []).find((a) => a.nombre === nombreAdaptador)
      || adaptadores.catalogo.obtener(nombreAdaptador);

    if (!config) {
      const err = new Error(`Adaptador no encontrado: ${nombreAdaptador}`);
      err.status = 400;
      err.codigo = 'ADAPTADOR_DESCONOCIDO';
      throw err;
    }
    doc = adaptadores.aplicar(entrada, config);
    infoAdaptador = { nombre: config.nombre, version: config.version || 1 };
  }

  // `tipoComprobante` viaja en el cuerpo pero no es un campo del comprobante:
  // se extrae con desestructuración para no mutar el objeto del cliente, que
  // es el req.body de Express y puede usarse después.
  const tipoComprobante = doc.tipoComprobante || entrada.tipoComprobante || 'FE';
  ({ ...doc } = doc);
  delete doc.tipoComprobante;

  // 2. Datos del emisor y fecha
  const fechaEmision = doc.fechaEmision ? new Date(doc.fechaEmision) : new Date();
  doc = completarEmisor(doc, tenant);
  doc.fechaEmision = fechaEmision.toISOString();

  // 3. Validar con numeración de relleno.
  //
  // Los montos llegan completos desde el cliente. La plataforma no los
  // recalcula ni los verifica: los totales, subtotales, impuestos y descuentos
  // responden a reglas del negocio del cliente, que es quien las conoce.
  // Nosotros comprobamos que la ESTRUCTURA cumpla el anexo y emitimos.
  //
  // La clave y el consecutivo son obligatorios, pero todavía no se generaron
  // porque no queremos gastar un número en un documento que puede ser
  // inválido. Se validan con marcadores del largo correcto y se sustituyen.
  const conRelleno = {
    ...doc,
    clave: doc.clave || '0'.repeat(50),
    numeroConsecutivo: doc.numeroConsecutivo || '0'.repeat(20),
  };

  const { valido, errores } = validar(conRelleno, tipoComprobante);
  if (!valido) throw new ErrorValidacion(errores);

  // 4. Numerar: recién ahora se consume la secuencia
  const { clave, consecutivo } = await numerar(tenant, tipoComprobante, fechaEmision);
  doc.clave = clave;
  doc.numeroConsecutivo = consecutivo;

  // 5. Renderizar y generar el PDF
  const plantilla = await resolverPlantilla(tenant, plantillaId);
  const ctx = await contextoRender(doc, plantilla, tipoComprobante);
  const html = renderHtml(doc, plantilla, ctx);
  const pdf = await generarPdf(html);

  // 6. Guardar el archivo antes que el registro: si el PDF falla, no queda un
  //    documento en base apuntando a un archivo inexistente.
  const guardado = await almacen.guardarPdf(tenant._id, clave, pdf);

  // 7. Registrar
  return Document.create({
    tenantId: tenant._id,
    clave,
    consecutivo,
    tipoComprobante,
    receptorCedula: doc.receptor?.identificacion?.numero,
    receptorNombre: doc.receptor?.nombre,
    fechaEmision,
    totalComprobante: doc.resumen?.totalComprobante ?? 0,
    moneda: doc.resumen?.codigoTipoMoneda?.codigoMoneda || 'CRC',
    payload: doc,
    plantillaSnapshot: plantilla,   // copia congelada, no referencia
    adaptador: infoAdaptador,
    pdf: { ruta: guardado.ruta, bytes: guardado.bytes, generadoEn: new Date() },
  });
}

/**
 * Vuelve a generar el PDF de un documento ya emitido.
 * Usa el snapshot de plantilla, no la plantilla actual: el comprobante se
 * reimprime tal como se emitió, aunque el tenant haya cambiado su diseño.
 */
async function regenerarPdf(documento) {
  const ctx = await contextoRender(
    documento.payload,
    documento.plantillaSnapshot,
    documento.tipoComprobante,
    { anulado: documento.estado === 'anulado' }
  );
  const html = renderHtml(documento.payload, documento.plantillaSnapshot, ctx);
  const pdf = await generarPdf(html);
  const guardado = await almacen.guardarPdf(documento.tenantId, documento.clave, pdf);

  documento.pdf = { ruta: guardado.ruta, bytes: guardado.bytes, generadoEn: new Date() };
  await documento.save();
  return documento;
}

/** Vista previa sin emitir: no numera, no guarda, no consume secuencia. ++ */

async function previsualizar({ tenant, entrada, adaptador: nombreAdaptador, plantilla, plantillaId }) {
  let doc = entrada;
  if (nombreAdaptador) {
    const config = (tenant.adaptadores || []).find((a) => a.nombre === nombreAdaptador)
      || adaptadores.catalogo.obtener(nombreAdaptador);
    if (config) doc = adaptadores.aplicar(entrada || config.ejemploEntrada, config);
  }

  const tipoComprobante = doc.tipoComprobante || 'FE';
  ({ ...doc } = doc);
  delete doc.tipoComprobante;

  doc = completarEmisor(doc, tenant);
  doc.fechaEmision = new Date().toISOString();

  doc.clave = '9'.repeat(50);
  doc.numeroConsecutivo = '9'.repeat(20);

  const plantillaResuelta = plantilla || await resolverPlantilla(tenant, plantillaId);

  const ctx = await contextoRender(doc, plantillaResuelta, tipoComprobante);
  return renderHtml(doc, plantillaResuelta, ctx);
}

/*async function previsualizar({ tenant, entrada, adaptador: nombreAdaptador, plantilla }) {
  let doc = entrada;
  if (nombreAdaptador) {
    const config = (tenant.adaptadores || []).find((a) => a.nombre === nombreAdaptador)
      || adaptadores.catalogo.obtener(nombreAdaptador);
    // Sin datos propios se usa el ejemplo del adaptador: así la vista previa
    // del editor se dibuja con el caso real del rubro, no con datos genéricos.
    if (config) doc = adaptadores.aplicar(entrada || config.ejemploEntrada, config);
  }

  const tipoComprobante = doc.tipoComprobante || 'FE';
  ({ ...doc } = doc);
  delete doc.tipoComprobante;

  doc = completarEmisor(doc, tenant);
  doc.fechaEmision = new Date().toISOString();

  // Numeración de muestra, claramente falsa, para que nadie la confunda con
  // un comprobante real.
  doc.clave = '9'.repeat(50);
  doc.numeroConsecutivo = '9'.repeat(20);

  const ctx = await contextoRender(doc, plantilla, tipoComprobante);
  return renderHtml(doc, plantilla, ctx);
}*/

/**
 * Emite una nota de crédito contra un comprobante ya emitido.
 *
 * Un comprobante electrónico NO se borra ni se edita. El anexo lo dice
 * explícitamente: "Toda corrección de un documento electrónico debe ser
 * realizada vía nota de crédito o débito electrónica ya que no se permite la
 * modificación ni la eliminación del mismo."
 *
 * La NC copia el detalle del original y lo referencia. El original queda
 * intacto en el historial, marcado como anulado solo para efectos de la
 * interfaz — el registro fiscal sigue siendo la pareja factura + nota.
 *
 * @param {object} opciones
 * @param {object} opciones.tenant
 * @param {object} opciones.original       Document a corregir
 * @param {string} opciones.razon          motivo, obligatorio
 * @param {string} [opciones.codigo]       nota 9: '01' anula completo, '02' corrige monto
 * @param {object} [opciones.montoParcial] para corrección parcial
 */
async function emitirNotaCredito({ tenant, original, razon, codigo = '01', montoParcial }) {
  if (!razon || String(razon).trim().length < 3) {
    const err = new Error('La razón de la nota de crédito es obligatoria (mínimo 3 caracteres)');
    err.status = 400;
    err.codigo = 'RAZON_REQUERIDA';
    throw err;
  }
  if (original.estado === 'anulado') {
    const err = new Error('El comprobante ya fue anulado');
    err.status = 409;
    err.codigo = 'YA_ANULADO';
    throw err;
  }

  const base = original.payload;

  // Tipo de documento de referencia según el comprobante original (nota 10)
  const TIPO_REF = { FE: '01', ND: '02', NC: '03', TE: '04', FEC: '08', FEE: '12' };

  const nc = {
    condicionVenta: base.condicionVenta,
    receptor: base.receptor,
    // La NC hereda el detalle y los totales del original: es exactamente lo que
    // se está reversando. La plataforma no recalcula nada — copia los montos
    // que el cliente envió cuando emitió el comprobante original.
    ...(base.detalleServicio ? { detalleServicio: base.detalleServicio } : {}),
    ...(base.otrosCargos ? { otrosCargos: base.otrosCargos } : {}),
    resumen: { ...base.resumen },
    informacionReferencia: [{
      tipoDocIr: TIPO_REF[original.tipoComprobante] || '01',
      numero: original.clave,
      fechaEmisionIr: original.fechaEmision.toISOString(),
      codigo,                       // '01' anula, '02' corrige monto
      razon: String(razon).slice(0, 180),
    }],
    ...(base.otros ? { otros: base.otros } : {}),
    tipoComprobante: 'NC',
  };

  // Corrección parcial: se ajusta por el monto que indica el cliente.
  //
  // El monto viene dado, no se deriva: la plataforma no decide cuánto se
  // reduce un cobro. Solo se verifica que no exceda el original, porque eso
  // convertiría la nota de crédito en un cobro encubierto.
  if (codigo === '02') {
    if (montoParcial == null) {
      const err = new Error('Para corregir un monto debe indicar montoParcial');
      err.status = 400;
      err.codigo = 'MONTO_REQUERIDO';
      throw err;
    }
    if (Number(montoParcial) > original.totalComprobante) {
      const err = new Error('El monto de la nota no puede superar el del comprobante original');
      err.status = 400;
      err.codigo = 'MONTO_EXCEDE_ORIGINAL';
      throw err;
    }

    const monto = Number(montoParcial);
    delete nc.detalleServicio;
    nc.otrosCargos = [{
      tipoDocumentoOc: '99',
      tipoDocumentoOtros: 'Ajuste por nota de crédito',
      detalle: String(razon).slice(0, 160),
      montoCargo: monto,
    }];
    nc.resumen = {
      codigoTipoMoneda: base.resumen?.codigoTipoMoneda,
      totalVenta: 0,
      totalVentaNeta: 0,
      totalOtrosCargos: monto,
      totalComprobante: monto,
      ...(base.resumen?.medioPago
        ? { medioPago: [{ ...base.resumen.medioPago[0], totalMedioPago: monto }] }
        : {}),
    };
  }

  const documento = await emitir({ tenant, entrada: nc });

  // El original queda anulado solo para la interfaz. El registro fiscal es la
  // pareja factura + nota de crédito; ninguno de los dos se borra.
  if (codigo === '01') {
    original.estado = 'anulado';
    await original.save();
    await regenerarPdf(original); // reimprime con la marca de agua ANULADO
  }

  return documento;
}

module.exports = {
  emitir,
  emitirNotaCredito,
  regenerarPdf,
  previsualizar,
  ErrorValidacion,
  completarEmisor,
  numerar,
};
