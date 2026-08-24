/**
 * seed.js — Siembra de datos iniciales
 * -----------------------------------------------------------------------------
 * Crea los modelos base de plantilla, los catálogos del anexo y un tenant de
 * ejemplo (el club) con su usuario y su API key.
 *
 * Ejecutar:  npm run seed
 * -----------------------------------------------------------------------------
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const { Tenant, User, Template, TemplateModel, Catalog } = require('../src/db/models');
const { hashPassword, generarApiKey } = require('../src/middleware/auth');
const { LAYOUT_POR_DEFECTO } = require('../src/render/plantilla');
const cat = require('../core/catalogos');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/facturacion';

// -----------------------------------------------------------------------------
// Modelos base de plantilla
// -----------------------------------------------------------------------------

const MODELOS = [
  {
    clave: 'clasica',
    nombre: 'Clásica',
    descripcion: 'Diseño completo con todos los bloques. Adecuada para facturas de venta.',
    layout: { bloques: LAYOUT_POR_DEFECTO },
    brandingPorDefecto: {
      colorPrimario: '#1a3a5c', colorTexto: '#222222',
      colorFondo: '#ffffff', fuente: 'Helvetica, Arial, sans-serif',
    },
  },
  {
    clave: 'compacta',
    nombre: 'Compacta',
    descripcion: 'Sin referencias ni campos personalizados. Para tiquetes y cobros simples.',
    layout: {
      bloques: [
        { tipo: 'encabezado', visible: true },
        { tipo: 'identificacion', visible: true },
        { tipo: 'receptor', visible: true },
        { tipo: 'detalle', visible: true, opciones: { mostrarCabys: false, mostrarDescuentos: false } },
        { tipo: 'otrosCargos', visible: true },
        { tipo: 'totales', visible: true },
      ],
    },
    brandingPorDefecto: {
      colorPrimario: '#2d2d2d', colorTexto: '#1a1a1a',
      colorFondo: '#ffffff', fuente: 'Helvetica, Arial, sans-serif',
    },
  },
  {
    clave: 'cargos',
    nombre: 'Cargos y multas',
    descripcion: 'Pensada para comprobantes sin líneas de detalle: multas, depósitos, intereses.',
    layout: {
      bloques: [
        { tipo: 'encabezado', visible: true },
        { tipo: 'identificacion', visible: true },
        { tipo: 'receptor', visible: true },
        { tipo: 'condiciones', visible: true },
        { tipo: 'otrosCargos', visible: true },
        { tipo: 'totales', visible: true },
        { tipo: 'camposPersonalizados', visible: true, opciones: { titulo: 'Detalles' } },
        { tipo: 'piePagina', visible: true },
      ],
    },
    brandingPorDefecto: {
      colorPrimario: '#0b6e3f', colorTexto: '#1a1a1a',
      colorFondo: '#ffffff', fuente: 'Helvetica, Arial, sans-serif',
    },
  },
];

// -----------------------------------------------------------------------------

async function sembrar() {
  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB\n');

  // --- Catálogos del anexo -----------------------------------------------
  for (const [nota, tabla] of Object.entries(cat.CATALOGOS)) {
    await Catalog.findByIdAndUpdate(
      `nota${nota}`,
      {
        _id: `nota${nota}`,
        nota: Number(nota),
        nombre: `Nota ${nota}`,
        entries: cat.opciones(Number(nota)),
      },
      { upsert: true }
    );
  }
  console.log(`Catálogos sembrados: ${Object.keys(cat.CATALOGOS).length} notas`);

  // --- Modelos base de plantilla -----------------------------------------
  for (const modelo of MODELOS) {
    await TemplateModel.findOneAndUpdate({ clave: modelo.clave }, modelo, { upsert: true });
  }
  console.log(`Modelos de plantilla: ${MODELOS.map((m) => m.clave).join(', ')}`);

  // --- Tenant de ejemplo --------------------------------------------------
  const CEDULA = '3101123456';
  let tenant = await Tenant.findOne({ 'identificacion.numero': CEDULA });

  if (tenant) {
    console.log('\nEl tenant de ejemplo ya existe. No se recrea.');
  } else {
    tenant = await Tenant.create({
      nombre: 'Asociación Deportiva Ejemplo',
      nombreComercial: 'Club Ejemplo FC',
      identificacion: { tipo: '02', numero: CEDULA },
      codigoActividad: '931201',
      proveedorSistemas: CEDULA,
      ubicacion: {
        provincia: '6', canton: '01', distrito: '01',
        barrio: 'Centro', otrasSenas: 'Estadio municipal, costado norte',
      },
      telefono: { codigoPais: 506, numTelefono: 26612233 },
      correos: ['administracion@clubejemplo.cr'],
    });

    const plantilla = await Template.create({
      tenantId: tenant._id,
      nombre: 'Comprobante del club',
      modeloBase: 'cargos',
      branding: {
        colorPrimario: '#0b6e3f', colorTexto: '#1a1a1a',
        colorFondo: '#ffffff', fuente: "'Segoe UI', Helvetica, Arial, sans-serif",
      },
      layout: {
        bloques: MODELOS.find((m) => m.clave === 'cargos').layout.bloques,
        piePagina: 'Consulte el reglamento disciplinario en clubejemplo.cr/reglamento',
      },
    });

    tenant.plantillaPorDefecto = plantilla._id;

    const { llave, prefijo, hash } = generarApiKey('test');
    tenant.apiKeys.push({ nombre: 'Integración del sistema de gestión', prefijo, hash });
    await tenant.save();

    await User.create({
      tenantId: tenant._id,
      email: 'admin@clubejemplo.cr',
      passwordHash: hashPassword('cambiar123'),
      nombre: 'Administrador',
      rol: 'admin',
    });

    console.log('\n' + '='.repeat(64));
    console.log('TENANT DE EJEMPLO CREADO');
    console.log('='.repeat(64));
    console.log(`Tenant:    ${tenant.nombre}`);
    console.log(`Panel:     admin@clubejemplo.cr  /  cambiar123`);
    console.log(`API key:   ${llave}`);
    console.log('='.repeat(64));
    console.log('Esta llave no se vuelve a mostrar. Cópiela ahora.');
    console.log('Cambie la contraseña del panel antes de exponer el servicio.\n');
  }

  await mongoose.connection.close();
}

sembrar().catch((err) => {
  console.error('Error al sembrar:', err);
  process.exit(1);
});
