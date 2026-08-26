/**
 * models.js — Esquemas de Mongoose
 * -----------------------------------------------------------------------------
 * Tres decisiones de diseño que conviene tener claras:
 *
 * 1. `documents.payload` es Mixed. El comprobante ya fue validado contra la
 *    matriz v4.4 antes de llegar acá; imponerle además un esquema de Mongoose
 *    sería una segunda fuente de verdad que se desincroniza.
 *
 * 2. `documents.plantillaSnapshot` guarda una COPIA de la plantilla, no una
 *    referencia. Si el tenant cambia su logo en marzo, la factura de enero debe
 *    seguir viéndose como se emitió.
 *
 * 3. Los receptores son usuarios propios, identificados por cédula. Un jugador
 *    entra con su cuenta y ve los comprobantes cuyo receptor coincide con su
 *    cédula, sin importar qué tenant los emitió.
 * -----------------------------------------------------------------------------
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// -----------------------------------------------------------------------------
// Tenant — el dueño del servicio que emite comprobantes
// -----------------------------------------------------------------------------

const ApiKeySchema = new Schema({
  nombre:     { type: String, required: true },
  prefijo:    { type: String, required: true },   // visible: "fk_live_a1b2"
  hash:       { type: String, required: true },   // scrypt de la llave completa
  creadaEn:   { type: Date, default: Date.now },
  ultimoUso:  Date,
  revocadaEn: Date,
}, { _id: true });

const TenantSchema = new Schema({
  nombre:            { type: String, required: true },
  identificacion: {
    tipo:   { type: String, required: true },     // nota 4
    numero: { type: String, required: true },
  },
  nombreComercial:   String,
  // Antes era obligatorio en el registro. Se deja opcional a propósito: cuando se integre el
  // futuro servicio de firma digital para validar la existencia real del cliente, es ESE
  // proceso el que debería completar/confirmar este dato (junto con lo que sea que ese servicio
  // exija), no un campo de texto libre sin validar que cualquiera llena a mano hoy.
  codigoActividad:   { type: String, default: null },
  proveedorSistemas: String,

  ubicacion: {
    provincia: String, canton: String, distrito: String,
    barrio: String, otrasSenas: String,
  },
  telefono: { codigoPais: Number, numTelefono: Number },
  correos:  [String],

  // Numeración: casa matriz y terminal por defecto
  local:    { type: Number, default: 1 },
  terminal: { type: Number, default: 1 },

  plantillaPorDefecto: { type: Schema.Types.ObjectId, ref: 'Template' },
  apiKeys:  [ApiKeySchema],

  // Traductores del formato propio del cliente al comprobante canónico.
  // Se guardan como configuración, no como código: agregar un cliente nuevo
  // no requiere desplegar. Mixed porque la forma del mapeo la define el tenant.
  adaptadores: { type: [Schema.Types.Mixed], default: [] },

  // Preparado para un futuro servicio de firma digital que confirme identidad/existencia real
  // del cliente. Todo opcional y con "Mixed" a propósito: hoy no se sabe qué datos exactos va a
  // devolver ese proveedor, y los tenants que ya existen (o que se registren antes de que esa
  // integración exista) tienen que seguir funcionando exactamente igual, sin migración ni campo
  // obligatorio que les falte. El día que se integre, el codigo simplemente empieza a llenar
  // esto para los tenants NUEVOS (o los que se re-verifiquen); los viejos quedan "sin_verificar"
  // indefinidamente, sin que eso les rompa nada.
  verificacion: {
    nivel:       { type: String, enum: ['sin_verificar', 'verificado'], default: 'sin_verificar' },
    proveedor:   { type: String, default: null },   // ej. "firma-digital-cr", cuando exista
    datos:       { type: Schema.Types.Mixed, default: null }, // lo que ese proveedor necesite guardar
    verificadoEn: { type: Date, default: null },
  },

  activo:   { type: Boolean, default: true },
}, { timestamps: true });

TenantSchema.index({ 'identificacion.numero': 1 }, { unique: true });

// -----------------------------------------------------------------------------
// Usuarios
// -----------------------------------------------------------------------------

/** Usuario del tenant: administra plantillas y ve el historial de emisión. */
const UserSchema = new Schema({
  tenantId:     { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  email:        { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  nombre:       String,
  rol:          { type: String, enum: ['admin', 'editor', 'lector'], default: 'admin' },
  activo:       { type: Boolean, default: true },
  ultimoAcceso: Date,
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });

/**
 * NO existe un modelo "Receptor" a propósito.
 *
 * El receptor de un comprobante (el jugador que recibe una multa) ya tiene
 * cuenta en el sistema del tenant. Duplicar esa identidad acá obligaría al
 * jugador a registrarse en una plataforma con la que nunca interactúa, y nos
 * pondría a custodiar credenciales de personas que no son nuestros usuarios.
 *
 * El flujo real es: el jugador se autentica en la app del club, el club nos
 * pide el PDF con su API key, y el club decide si ese jugador puede verlo.
 * Nosotros solo garantizamos que un tenant no pueda leer documentos de otro.
 */

// -----------------------------------------------------------------------------
// Plantillas
// -----------------------------------------------------------------------------

/** Modelo base del catálogo. Lo provee la plataforma, no el tenant. */
const TemplateModelSchema = new Schema({
  clave:       { type: String, required: true, unique: true }, // 'clasica', 'compacta'
  nombre:      { type: String, required: true },
  descripcion: String,
  preview:     String,
  layout: {
    bloques: [{
      tipo:     { type: String, required: true },
      visible:  { type: Boolean, default: true },
      opciones: Schema.Types.Mixed,
    }],
  },
  brandingPorDefecto: {
    colorPrimario: String, colorTexto: String, colorFondo: String, fuente: String,
  },
});

/** Plantilla personalizada de un tenant, derivada de un modelo base. */
const TemplateSchema = new Schema({
  tenantId:      { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  nombre:        { type: String, required: true },
  modeloBase:    { type: String, required: true },
  version:       { type: Number, default: 1 },

  branding: {
    logoUrl:       String,
    colorPrimario: { type: String, default: '#1a3a5c' },
    colorTexto:    { type: String, default: '#222222' },
    colorFondo:    { type: String, default: '#ffffff' },
    fuente:        { type: String, default: 'Helvetica, Arial, sans-serif' },
  },

  // Bloques en el orden en que se imprimen. El bloque 'identificacion' no se
  // puede ocultar ni dividir: la nota 1 exige que tipo de documento, clave y
  // consecutivo queden juntos.
  layout: {
    bloques: [{
      tipo:     { type: String, required: true },
      visible:  { type: Boolean, default: true },
      opciones: Schema.Types.Mixed,
    }],
    piePagina:  String,
    mostrarQr:  { type: Boolean, default: false },
  },

  activa: { type: Boolean, default: true },
}, { timestamps: true });

TemplateSchema.index({ tenantId: 1, activa: 1 });

// -----------------------------------------------------------------------------
// Documentos emitidos
// -----------------------------------------------------------------------------

const DocumentSchema = new Schema({
  tenantId:         { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  clave:            { type: String, required: true },
  consecutivo:      { type: String, required: true },
  tipoComprobante:  { type: String, required: true },

  // Desnormalizado para poder buscar los comprobantes de un receptor sin
  // recorrer el payload de cada documento.
  receptorCedula:   { type: String, index: true },
  receptorNombre:   String,

  fechaEmision:     { type: Date, required: true },
  totalComprobante: { type: Number, required: true },
  moneda:           { type: String, default: 'CRC' },

  estado: { type: String, enum: ['emitido', 'anulado'], default: 'emitido' },

  payload:            { type: Schema.Types.Mixed, required: true },
  plantillaSnapshot:  { type: Schema.Types.Mixed, required: true },
  adaptador:          { nombre: String, version: Number },

  pdf: {
    ruta:       String,     // mongo://pdffiles/<clave> (ver storage/almacen.js)
    bytes:      Number,
    generadoEn: Date,
  },
}, { timestamps: true });

DocumentSchema.index({ clave: 1 }, { unique: true });
DocumentSchema.index({ tenantId: 1, fechaEmision: -1 });
DocumentSchema.index({ receptorCedula: 1, fechaEmision: -1 });

// -----------------------------------------------------------------------------
// Contador de consecutivos
//
// Un documento por combinación tenant/local/terminal/tipo. Se incrementa con
// findOneAndUpdate atómico: dos peticiones simultáneas nunca reciben el mismo
// número, que produciría claves duplicadas.
// -----------------------------------------------------------------------------

const CounterSchema = new Schema({
  _id: String,               // "<tenantId>:001:00001:FE"
  seq: { type: Number, default: 0 },
});

CounterSchema.statics.siguiente = async function (llave) {
  const doc = await this.findOneAndUpdate(
    { _id: llave },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

// -----------------------------------------------------------------------------
// Catálogos sembrados desde core/catalogos.js
// -----------------------------------------------------------------------------

const CatalogSchema = new Schema({
  _id:     String,           // "nota16"
  nota:    Schema.Types.Mixed,
  nombre:  String,
  entries: [{ codigo: String, descripcion: String }],
});

// -----------------------------------------------------------------------------
// Binario de los PDFs (ver storage/almacen.js)
//
// Todo vive en Mongo a propósito: un solo lugar que respaldar, sin bucket
// externo ni credencial aparte que custodiar. Un comprobante pesa entre 30 y
// 200 KB, muy por debajo del límite de 16 MB de BSON (almacen.js avisa/corta
// antes de acercarse a ese límite).
// -----------------------------------------------------------------------------

const PdfFileSchema = new Schema({
  clave:       { type: String, required: true, unique: true },
  tenantId:    { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  contenido:   { type: Buffer, required: true },
  bytes:       { type: Number, required: true },
  contentType: { type: String, default: 'application/pdf' },
  generadoEn:  { type: Date, default: Date.now },
});

PdfFileSchema.index({ clave: 1, tenantId: 1 });

module.exports = {
  Tenant:        mongoose.model('Tenant', TenantSchema),
  User:          mongoose.model('User', UserSchema),
  TemplateModel: mongoose.model('TemplateModel', TemplateModelSchema),
  Template:      mongoose.model('Template', TemplateSchema),
  Document:      mongoose.model('Document', DocumentSchema),
  Counter:       mongoose.model('Counter', CounterSchema),
  Catalog:       mongoose.model('Catalog', CatalogSchema),
  PdfFile:       mongoose.model('PdfFile', PdfFileSchema),
};
