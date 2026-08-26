/**
 * panel.js — Rutas del panel web
 * -----------------------------------------------------------------------------
 * El panel administra plantillas, llaves y consulta el historial. NO emite
 * comprobantes: eso es exclusivo de la API con llave, porque quien tiene el
 * contexto del negocio es el sistema del cliente, no una persona llenando un
 * formulario.
 * -----------------------------------------------------------------------------
 */

'use strict';

const express = require('express');
const { Tenant, User, Template, TemplateModel, Document } = require('../db/models');
const auth = require('../middleware/auth');
const { validarLayout, LAYOUT_POR_DEFECTO } = require('../render/plantilla');
const { CATALOGO_BLOQUES } = require('../render/bloques');
const emision = require('../services/emision');
const almacen = require('../storage/almacen');
const cat = require('../../core/catalogos');
const ubicaciones = require('../../core/ubicaciones');
const adaptadores = require('../adaptadores');
const { limitarIntentos } = require('../middleware/limitarIntentos');

const router = express.Router();

// -----------------------------------------------------------------------------
// Sesión
// -----------------------------------------------------------------------------

/**
 * Pública a propósito: el formulario de registro necesita las provincias (y los
 * cantones de la elegida) antes de que exista ninguna cuenta con la que
 * autenticarse. Los distritos no se exponen aquí: el catálogo completo no está
 * cargado en este proyecto (ver la nota en core/ubicaciones.js), así que ese
 * campo se pide como código numérico simple en el formulario.
 */
router.get('/ubicaciones', (req, res) => {
  const { provincia } = req.query;
  res.json({
    provincias: ubicaciones.opcionesProvincias(),
    cantones: provincia ? ubicaciones.opcionesCantones(provincia) : [],
  });
});

router.post('/auth/login', limitarIntentos(10), async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'DATOS_INCOMPLETOS' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    // Mismo mensaje si el correo no existe o la contraseña es incorrecta: no se
    // revela qué correos están registrados.
    if (!user || !user.activo || !auth.verificarPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'CREDENCIALES_INVALIDAS' });
    }

    user.ultimoAcceso = new Date();
    await user.save();

    const tenant = await Tenant.findById(user.tenantId);
    res.json({
      token: auth.firmarToken(user),
      usuario: { id: String(user._id), email: user.email, nombre: user.nombre, rol: user.rol },
      tenant: { id: String(tenant._id), nombre: tenant.nombre },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Alta de un cliente nuevo, sin intervención manual.
 *
 * Antes de esto, la única forma de crear un tenant era a mano con scripts/seed.js.
 * Acá se piden los campos que el emisor necesita para poder facturar de inmediato
 * (ver core/fieldRules.js, sección "emisor"): pedirlos todos ahora evita que el
 * cliente descubra un campo faltante recién cuando intenta emitir su primera factura.
 *
 * EXCEPCIÓN a propósito: codigoActividad. También es obligatorio para poder emitir
 * (fieldRules.js lo exige), pero NO se pide acá: queda en null hasta que el futuro
 * servicio de firma digital lo complete/confirme al validar la existencia real del
 * cliente (ver TenantSchema.verificacion en db/models.js). Un tenant registrado hoy
 * no va a poder emitir comprobantes hasta que ese dato se complete de alguna forma
 * (por ahora, editándolo a mano si hiciera falta probar la emisión antes de que esa
 * integración exista).
 *
 * Se valida la identificación y el correo ANTES de crear nada, para no dejar un
 * tenant a medias si el usuario falla por correo duplicado.
 */
router.post('/auth/registro', limitarIntentos(5), async (req, res, next) => {
  try {
    const { tenant: datosTenant, usuario: datosUsuario } = req.body || {};

    if (!datosTenant || !datosUsuario) {
      return res.status(400).json({
        error: 'DATOS_INCOMPLETOS',
        mensaje: 'El body debe incluir "tenant" y "usuario".',
      });
    }

    const campoFalta = (valor) => valor === undefined || valor === null || valor === '';
    const camposFaltantes = [];

    if (campoFalta(datosTenant.nombre)) camposFaltantes.push('tenant.nombre');
    if (campoFalta(datosTenant.identificacion?.tipo)) camposFaltantes.push('tenant.identificacion.tipo');
    if (campoFalta(datosTenant.identificacion?.numero)) camposFaltantes.push('tenant.identificacion.numero');
    if (campoFalta(datosTenant.ubicacion?.provincia)) camposFaltantes.push('tenant.ubicacion.provincia');
    if (campoFalta(datosTenant.ubicacion?.canton)) camposFaltantes.push('tenant.ubicacion.canton');
    if (campoFalta(datosTenant.ubicacion?.distrito)) camposFaltantes.push('tenant.ubicacion.distrito');
    if (campoFalta(datosTenant.ubicacion?.otrasSenas)) camposFaltantes.push('tenant.ubicacion.otrasSenas');
    if (!Array.isArray(datosTenant.correos) || datosTenant.correos.length === 0) camposFaltantes.push('tenant.correos');
    if (campoFalta(datosUsuario.email)) camposFaltantes.push('usuario.email');
    if (campoFalta(datosUsuario.password)) camposFaltantes.push('usuario.password');

    if (camposFaltantes.length) {
      return res.status(400).json({ error: 'DATOS_INCOMPLETOS', detalles: camposFaltantes });
    }
    if (String(datosUsuario.password).length < 8) {
      return res.status(400).json({
        error: 'PASSWORD_DEBIL',
        mensaje: 'La contraseña debe tener al menos 8 caracteres.',
      });
    }

    const email = String(datosUsuario.email).toLowerCase().trim();

    const [tenantExistente, usuarioExistente] = await Promise.all([
      Tenant.findOne({ 'identificacion.numero': datosTenant.identificacion.numero }),
      User.findOne({ email }),
    ]);
    if (tenantExistente) {
      return res.status(409).json({ error: 'IDENTIFICACION_YA_REGISTRADA' });
    }
    if (usuarioExistente) {
      return res.status(409).json({ error: 'CORREO_YA_REGISTRADO' });
    }

    const tenant = await Tenant.create({
      nombre: datosTenant.nombre,
      nombreComercial: datosTenant.nombreComercial,
      identificacion: {
        tipo: datosTenant.identificacion.tipo,
        numero: datosTenant.identificacion.numero,
      },
      ubicacion: {
        provincia: datosTenant.ubicacion.provincia,
        canton: datosTenant.ubicacion.canton,
        distrito: datosTenant.ubicacion.distrito,
        barrio: datosTenant.ubicacion.barrio,
        otrasSenas: datosTenant.ubicacion.otrasSenas,
      },
      telefono: datosTenant.telefono,
      correos: datosTenant.correos,
    });

    // Primera llave de API, para que pueda empezar a integrar de inmediato. Se muestra
    // UNA sola vez en la respuesta, igual que las llaves creadas desde POST /llaves.
    const { llave, prefijo, hash } = auth.generarApiKey('live');
    tenant.apiKeys.push({ nombre: 'Llave inicial', prefijo, hash });
    await tenant.save();

    const usuario = await User.create({
      tenantId: tenant._id,
      email,
      passwordHash: auth.hashPassword(datosUsuario.password),
      nombre: datosUsuario.nombre,
      rol: 'admin',
    });

    res.status(201).json({
      token: auth.firmarToken(usuario),
      usuario: { id: String(usuario._id), email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      tenant: { id: String(tenant._id), nombre: tenant.nombre },
      apiKey: llave,
    });
  } catch (err) {
    next(err);
  }
});

router.use(auth.autenticarUsuario);

/**
 * Renueva el token sin volver a pedir contraseña.
 *
 * El panel la llama mientras el usuario está activo. Como el token dura una
 * hora y solo se renueva con actividad, el efecto neto es cierre de sesión por
 * inactividad: si el usuario deja la pestaña abierta y se va, nadie renueva y
 * el token vence solo.
 */
router.post('/auth/renovar', (req, res) => {
  res.json({ token: auth.firmarToken(req.user), expiraEn: auth.DURACION_SESION_MS });
});

router.get('/auth/me', (req, res) => {
  res.json({
    usuario: {
      id: String(req.user._id), email: req.user.email,
      nombre: req.user.nombre, rol: req.user.rol,
    },
    tenant: {
      id: String(req.tenant._id),
      nombre: req.tenant.nombre,
      identificacion: req.tenant.identificacion,
    },
  });
});

/**
 * GET /panel/perfil
 * Datos editables del perfil: los del propio usuario y los del tenant que tiene sentido poder
 * cambiar después del registro. A propósito NO incluye identificación ni codigoActividad: esos
 * quedan atados a la verificación real de existencia del cliente (ver TenantSchema.verificacion
 * en db/models.js), no a una edición libre desde acá.
 */
router.get('/perfil', (req, res) => {
  res.json({
    usuario: {
      nombre: req.user.nombre,
      email: req.user.email,
    },
    tenant: {
      nombreComercial: req.tenant.nombreComercial,
      telefono: req.tenant.telefono,
      correos: req.tenant.correos,
      ubicacion: req.tenant.ubicacion,
    },
  });
});

/**
 * PUT /panel/perfil
 * Actualiza los datos editables. Los dos bloques (usuario/tenant) son independientes: se puede
 * mandar uno solo, el otro, o los dos juntos.
 *
 * Cambiar la contraseña exige la actual (passwordActual), para confirmar que quien tiene la
 * sesión abierta es realmente el dueño de la cuenta y no solo alguien que encontró el navegador
 * abierto.
 */
router.put('/perfil', async (req, res, next) => {
  try {
    const { usuario: datosUsuario, tenant: datosTenant } = req.body || {};

    if (datosUsuario) {
      if (datosUsuario.nombre !== undefined) {
        req.user.nombre = datosUsuario.nombre;
      }

      if (datosUsuario.email !== undefined) {
        const email = String(datosUsuario.email).toLowerCase().trim();
        if (email !== req.user.email) {
          const existente = await User.findOne({ email });
          if (existente) return res.status(409).json({ error: 'CORREO_YA_REGISTRADO' });
          req.user.email = email;
        }
      }

      if (datosUsuario.passwordNueva) {
        if (!datosUsuario.passwordActual) {
          return res.status(400).json({
            error: 'FALTA_PASSWORD_ACTUAL',
            mensaje: 'Debe indicar su contraseña actual para cambiarla.',
          });
        }
        if (!auth.verificarPassword(datosUsuario.passwordActual, req.user.passwordHash)) {
          return res.status(401).json({ error: 'PASSWORD_INCORRECTA', mensaje: 'La contraseña actual no es correcta.' });
        }
        if (String(datosUsuario.passwordNueva).length < 8) {
          return res.status(400).json({ error: 'PASSWORD_DEBIL', mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.' });
        }
        req.user.passwordHash = auth.hashPassword(datosUsuario.passwordNueva);
      }

      await req.user.save();
    }

    if (datosTenant) {
      if (datosTenant.nombreComercial !== undefined) req.tenant.nombreComercial = datosTenant.nombreComercial;
      if (datosTenant.telefono !== undefined) req.tenant.telefono = datosTenant.telefono;
      if (Array.isArray(datosTenant.correos) && datosTenant.correos.length) req.tenant.correos = datosTenant.correos;

      if (datosTenant.ubicacion) {
        const { provincia, canton, distrito, barrio, otrasSenas } = datosTenant.ubicacion;
        if (provincia !== undefined) req.tenant.ubicacion.provincia = provincia;
        if (canton !== undefined) req.tenant.ubicacion.canton = canton;
        if (distrito !== undefined) req.tenant.ubicacion.distrito = distrito;
        if (barrio !== undefined) req.tenant.ubicacion.barrio = barrio;
        if (otrasSenas !== undefined) req.tenant.ubicacion.otrasSenas = otrasSenas;
      }

      await req.tenant.save();
    }

    res.json({
      usuario: { nombre: req.user.nombre, email: req.user.email },
      tenant: {
        nombreComercial: req.tenant.nombreComercial,
        telefono: req.tenant.telefono,
        correos: req.tenant.correos,
        ubicacion: req.tenant.ubicacion,
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Catálogos y metadatos para el editor
// -----------------------------------------------------------------------------

router.get('/catalogos', (req, res) => {
  const notas = String(req.query.notas || '')
    .split(',').map((n) => n.trim()).filter(Boolean);

  const llaves = notas.length ? notas : Object.keys(cat.CATALOGOS);
  const salida = {};
  for (const n of llaves) salida[`nota${n}`] = cat.opciones(Number(n));
  res.json(salida);
});

router.get('/bloques', (req, res) => {
  res.json({ bloques: CATALOGO_BLOQUES, layoutPorDefecto: LAYOUT_POR_DEFECTO });
});

router.get('/modelos', async (req, res, next) => {
  try {
    res.json({ modelos: await TemplateModel.find().sort({ nombre: 1 }) });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Plantillas
// -----------------------------------------------------------------------------

router.get('/plantillas', async (req, res, next) => {
  try {
    const plantillas = await Template.find({ tenantId: req.tenant._id }).sort({ createdAt: -1 });
    res.json({
      plantillas,
      porDefecto: req.tenant.plantillaPorDefecto ? String(req.tenant.plantillaPorDefecto) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/plantillas', auth.exigirRol('admin', 'editor'), async (req, res, next) => {
  try {
    const { nombre, modeloBase = 'clasica', branding, layout } = req.body || {};
    if (!nombre) return res.status(400).json({ error: 'NOMBRE_REQUERIDO' });

    const modelo = await TemplateModel.findOne({ clave: modeloBase });
    const layoutFinal = layout || modelo?.layout || { bloques: LAYOUT_POR_DEFECTO };

    const errores = validarLayout(layoutFinal);
    if (errores.length) {
      return res.status(422).json({ error: 'LAYOUT_INVALIDO', detalles: errores });
    }

    const plantilla = await Template.create({
      tenantId: req.tenant._id,
      nombre,
      modeloBase,
      branding: { ...(modelo?.brandingPorDefecto || {}), ...(branding || {}) },
      layout: layoutFinal,
    });

    // La primera plantilla queda como la predeterminada.
    if (!req.tenant.plantillaPorDefecto) {
      req.tenant.plantillaPorDefecto = plantilla._id;
      await req.tenant.save();
    }

    res.status(201).json(plantilla);
  } catch (err) {
    next(err);
  }
});

router.put('/plantillas/:id', auth.exigirRol('admin', 'editor'), async (req, res, next) => {
  try {
    const plantilla = await Template.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!plantilla) return res.status(404).json({ error: 'NO_ENCONTRADA' });

    const { nombre, branding, layout } = req.body || {};

    if (layout) {
      const errores = validarLayout(layout);
      if (errores.length) {
        return res.status(422).json({ error: 'LAYOUT_INVALIDO', detalles: errores });
      }
      plantilla.layout = layout;
    }
    if (nombre) plantilla.nombre = nombre;
    if (branding) plantilla.branding = { ...plantilla.branding.toObject(), ...branding };

    // La versión sube en cada cambio. Los documentos ya emitidos guardan su
    // propio snapshot, así que no se ven afectados.
    plantilla.version += 1;
    await plantilla.save();

    res.json(plantilla);
  } catch (err) {
    next(err);
  }
});

router.post('/plantillas/:id/por-defecto', auth.exigirRol('admin'), async (req, res, next) => {
  try {
    const plantilla = await Template.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!plantilla) return res.status(404).json({ error: 'NO_ENCONTRADA' });

    req.tenant.plantillaPorDefecto = plantilla._id;
    await req.tenant.save();
    res.json({ ok: true, plantillaPorDefecto: String(plantilla._id) });
  } catch (err) {
    next(err);
  }
});

/**
 * Vista previa en vivo del editor.
 *
 * Devuelve el MISMO HTML que se imprime a PDF. El frontend lo mete en un
 * iframe. Si el preview se generara por otro camino, se vería distinto al PDF
 * y perseguir esas diferencias cuesta más que construir el editor entero.
 */
router.post('/plantillas/preview', async (req, res, next) => {
  try {
    const { branding, layout, datosEjemplo, adaptador } = req.body || {};

    const errores = validarLayout(layout || { bloques: LAYOUT_POR_DEFECTO });
    if (errores.length) {
      return res.status(422).json({ error: 'LAYOUT_INVALIDO', detalles: errores });
    }

    // Con adaptador, la vista previa se dibuja con el caso real de ese rubro:
    // se diseña viendo lo que va a salir, no datos genéricos.
    const config = adaptador
      ? (req.tenant.adaptadores || []).find((a) => a.nombre === adaptador)
        || adaptadores.catalogo.obtener(adaptador)
      : null;

    const html = await emision.previsualizar({
      tenant: req.tenant,
      entrada: datosEjemplo || config?.ejemploEntrada || EJEMPLO_PREVIEW,
      adaptador: config ? adaptador : undefined,
      plantilla: { branding: branding || {}, layout: layout || { bloques: LAYOUT_POR_DEFECTO } },
    });

    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

/** Datos de muestra para que el editor tenga algo que dibujar. */
const EJEMPLO_PREVIEW = {
  condicionVenta: '01',
  receptor: {
    nombre: 'Nombre del Receptor',
    identificacion: { tipo: '01', numero: '112345678' },
    correoElectronico: 'receptor@ejemplo.cr',
  },
  detalleServicio: {
    lineaDetalle: [
      { codigoCabys: '9312000000000', cantidad: 1, unidadMedida: 'Unid',
        detalle: 'Servicio de ejemplo', precioUnitario: 25000,
        impuesto: [{ codigo: '01', codigoTarifaIva: '08' }] },
      { codigoCabys: '9312000000000', cantidad: 2, unidadMedida: 'Unid',
        detalle: 'Otro concepto con descuento', precioUnitario: 12000,
        descuento: [{ montoDescuento: 2000, codigoDescuento: '06' }],
        impuesto: [{ codigo: '01', codigoTarifaIva: '08' }] },
    ],
  },
  resumen: {
    codigoTipoMoneda: { codigoMoneda: 'CRC', tipoCambio: 1 },
    medioPago: [{ tipoMedioPago: '04' }],
  },
  otros: { otroTexto: ['Dato personalizado de ejemplo'] },
};

// -----------------------------------------------------------------------------
// Historial (solo lectura)
// -----------------------------------------------------------------------------

router.get('/documentos', async (req, res, next) => {
  try {
    const { desde, hasta, receptor, tipo, estado, q, page = 1, limit = 25 } = req.query;

    const filtro = { tenantId: req.tenant._id };
    if (receptor) filtro.receptorCedula = String(receptor).replace(/\D/g, '');
    if (tipo) filtro.tipoComprobante = tipo;
    if (estado) filtro.estado = estado;
    if (q) filtro.$or = [
      { receptorNombre: new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { clave: String(q) },
      { consecutivo: String(q) },
    ];
    if (desde || hasta) {
      filtro.fechaEmision = {};
      if (desde) filtro.fechaEmision.$gte = new Date(desde);
      if (hasta) filtro.fechaEmision.$lte = new Date(hasta);
    }

    const porPagina = Math.min(Number(limit) || 25, 100);
    const saltar = (Math.max(Number(page) || 1, 1) - 1) * porPagina;

    const [docs, total, suma] = await Promise.all([
      Document.find(filtro)
        .select('-payload -plantillaSnapshot')
        .sort({ fechaEmision: -1 }).skip(saltar).limit(porPagina),
      Document.countDocuments(filtro),
      Document.aggregate([
        { $match: { ...filtro, estado: 'emitido' } },
        { $group: { _id: '$moneda', total: { $sum: '$totalComprobante' }, cantidad: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      datos: docs,
      totales: suma,
      paginacion: { pagina: Number(page) || 1, porPagina, total, paginas: Math.ceil(total / porPagina) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/documentos/:id', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!doc) return res.status(404).json({ error: 'NO_ENCONTRADO' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.get('/documentos/:id/pdf', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!doc) return res.status(404).json({ error: 'NO_ENCONTRADO' });

    if (!(await almacen.existePdf(req.tenant._id, doc.clave))) {
      await emision.regenerarPdf(doc);
    }
    const buffer = await almacen.leerPdf(req.tenant._id, doc.clave);
    res.type('pdf')
      .set('Content-Disposition', `inline; filename="${doc.clave}.pdf"`)
      .set('Cache-Control', 'private, no-store')
      .send(buffer);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Llaves de API
// -----------------------------------------------------------------------------

router.get('/llaves', auth.exigirRol('admin'), (req, res) => {
  // Nunca se devuelve el hash. Solo el prefijo, que sirve para identificarla.
  res.json({
    llaves: req.tenant.apiKeys.map((k) => ({
      id: String(k._id),
      nombre: k.nombre,
      prefijo: `${k.prefijo}...`,
      creadaEn: k.creadaEn,
      ultimoUso: k.ultimoUso,
      revocada: Boolean(k.revocadaEn),
    })),
  });
});

router.post('/llaves', auth.exigirRol('admin'), async (req, res, next) => {
  try {
    const { nombre, entorno = 'live' } = req.body || {};
    if (!nombre) return res.status(400).json({ error: 'NOMBRE_REQUERIDO' });

    const { llave, prefijo, hash } = auth.generarApiKey(entorno);
    req.tenant.apiKeys.push({ nombre, prefijo, hash });
    await req.tenant.save();

    res.status(201).json({
      llave,   // se muestra UNA sola vez; después solo queda el hash
      prefijo,
      nombre,
      aviso: 'Guarde esta llave ahora. No se puede volver a mostrar.',
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/llaves/:id', auth.exigirRol('admin'), async (req, res, next) => {
  try {
    const llave = req.tenant.apiKeys.id(req.params.id);
    if (!llave) return res.status(404).json({ error: 'NO_ENCONTRADA' });

    // Se revoca, no se borra: el historial de qué llave emitió qué se conserva.
    llave.revocadaEn = new Date();
    await req.tenant.save();
    res.json({ ok: true, revocadaEn: llave.revocadaEn });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Adaptadores
// -----------------------------------------------------------------------------

router.get('/adaptadores', (req, res) => {
  res.json({
    propios: req.tenant.adaptadores || [],
    catalogo: adaptadores.catalogo.CATALOGO,
    porCategoria: adaptadores.catalogo.porCategoria(),
    transformaciones: Object.keys(adaptadores.TRANSFORMACIONES),
  });
});

router.post('/adaptadores', auth.exigirRol('admin', 'editor'), async (req, res, next) => {
  try {
    const adaptador = req.body || {};
    const errores = adaptadores.validarAdaptador(adaptador);
    if (errores.length) {
      return res.status(422).json({ error: 'ADAPTADOR_INVALIDO', detalles: errores });
    }

    req.tenant.adaptadores = req.tenant.adaptadores || [];
    const i = req.tenant.adaptadores.findIndex((a) => a.nombre === adaptador.nombre);

    if (i >= 0) {
      adaptador.version = (req.tenant.adaptadores[i].version || 1) + 1;
      req.tenant.adaptadores[i] = adaptador;
    } else {
      adaptador.version = 1;
      req.tenant.adaptadores.push(adaptador);
    }

    req.tenant.markModified('adaptadores');
    await req.tenant.save();
    res.json(adaptador);
  } catch (err) {
    next(err);
  }
});

/** Prueba un adaptador contra un JSON de ejemplo, sin emitir nada. */
router.post('/adaptadores/probar', async (req, res, next) => {
  try {
    const { adaptador, entrada } = req.body || {};

    const errores = adaptadores.validarAdaptador(adaptador || {});
    if (errores.length) {
      return res.status(422).json({ error: 'ADAPTADOR_INVALIDO', detalles: errores });
    }

    const canonico = adaptadores.aplicar(entrada || {}, adaptador);
    const { validar } = require('../../core/validador');

    const completo = emision.completarEmisor(canonico, req.tenant);
    completo.fechaEmision = new Date().toISOString();
    completo.clave = '0'.repeat(50);
    completo.numeroConsecutivo = '0'.repeat(20);

    const resultado = validar(completo, adaptador.tipoComprobante || 'FE');

    res.json({
      canonico,
      resumen: completo.resumen || null,
      validacion: resultado,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
