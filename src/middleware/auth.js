/**
 * auth.js — Autenticación
 * -----------------------------------------------------------------------------
 * Dos mecanismos separados, para dos consumidores distintos:
 *
 *   API key (x-api-key)  -> el sistema del cliente. Emite comprobantes.
 *   JWT (Bearer)         -> el usuario del panel. Administra plantillas.
 *
 * Un sistema no debería poder cambiar plantillas, y un usuario del panel no
 * debería emitir facturas a mano. Por eso no se comparte el mismo token.
 * -----------------------------------------------------------------------------
 */

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Tenant, User } = require('../db/models');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET es obligatorio en producción');
}
const SECRETO = JWT_SECRET || 'desarrollo-inseguro-no-usar-en-produccion';
// Una hora. La sesión se renueva sola mientras el usuario esté activo, así que
// este plazo funciona como inactividad máxima, no como duración total.
const JWT_TTL = process.env.JWT_TTL || '1h';

// -----------------------------------------------------------------------------
// Contraseñas — scrypt, no bcrypt: viene en el core de Node, sin dependencias
// -----------------------------------------------------------------------------

const N = 16384, r = 8, p = 1, LARGO = 64;

function hashPassword(plano) {
  const sal = crypto.randomBytes(16);
  const derivada = crypto.scryptSync(plano, sal, LARGO, { N, r, p });
  return `scrypt$${sal.toString('hex')}$${derivada.toString('hex')}`;
}

// verificarPassword: recalcula el hash con la misma sal guardada y compara en tiempo
// constante (ver más abajo), para no filtrar nada por cuánto tarda la respuesta.
function verificarPassword(plano, almacenado) {
  try {
    const [algo, salHex, hashHex] = String(almacenado).split('$');
    if (algo !== 'scrypt') return false;
    const derivada = crypto.scryptSync(plano, Buffer.from(salHex, 'hex'), LARGO, { N, r, p });
    // Comparación en tiempo constante: evita filtrar el hash por temporización.
    return crypto.timingSafeEqual(derivada, Buffer.from(hashHex, 'hex'));
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// API keys
//
// La llave completa se muestra UNA sola vez, al crearla. En base solo queda el
// prefijo (para poder buscarla) y el hash. Si el tenant la pierde, se revoca y
// se emite otra; no hay forma de recuperarla, que es justamente el punto.
// -----------------------------------------------------------------------------

function generarApiKey(entorno = 'live') {
  const cuerpo = crypto.randomBytes(24).toString('base64url');
  const llave = `fk_${entorno}_${cuerpo}`;
  const prefijo = llave.slice(0, 16);
  return { llave, prefijo, hash: hashPassword(llave) };
}

/**
 * Middleware: autentica al sistema cliente por API key.
 * Deja en req.tenant el tenant y en req.apiKeyId la llave usada.
 */
async function autenticarApiKey(req, res, next) {
  const llave = req.get('x-api-key');
  if (!llave) {
    return res.status(401).json({
      error: 'API_KEY_FALTANTE',
      mensaje: 'Incluya su llave en el encabezado x-api-key',
    });
  }

  const prefijo = llave.slice(0, 16);

  // $elemMatch: sin esto, Mongo puede satisfacer "prefijo" con una llave y
  // "no revocada" con otra distinta del mismo arreglo.
  const tenant = await Tenant.findOne({
    apiKeys: { $elemMatch: { prefijo, revocadaEn: { $exists: false } } },
    activo: true,
  });

  const registro = tenant?.apiKeys.find(
    (k) => k.prefijo === prefijo && !k.revocadaEn && verificarPassword(llave, k.hash)
  );

  if (!registro) {
    return res.status(401).json({ error: 'API_KEY_INVALIDA', mensaje: 'Llave inválida o revocada' });
  }

  // Se registra el uso sin bloquear la respuesta.
  Tenant.updateOne(
    { _id: tenant._id, 'apiKeys._id': registro._id },
    { $set: { 'apiKeys.$.ultimoUso': new Date() } }
  ).catch(() => {});

  req.tenant = tenant;
  req.apiKeyId = registro._id;
  next();
}

// -----------------------------------------------------------------------------
// JWT del panel
// -----------------------------------------------------------------------------

function firmarToken(user) {
  return jwt.sign(
    { sub: String(user._id), tid: String(user.tenantId), rol: user.rol },
    SECRETO,
    { expiresIn: JWT_TTL }
  );
}

// autenticarUsuario: middleware del panel. Exige un JWT válido (Bearer) y deja al usuario y su
// tenant en req.user/req.tenant, para que las rutas de abajo no tengan que repetir esto.
async function autenticarUsuario(req, res, next) {
  const cabecera = req.get('authorization') || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'NO_AUTENTICADO', mensaje: 'Falta el token de sesión' });
  }

  let payload;
  try {
    payload = jwt.verify(token, SECRETO);
  } catch (err) {
    const expirado = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO',
      mensaje: expirado ? 'La sesión venció, inicie sesión de nuevo' : 'Token inválido',
    });
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.activo) {
    return res.status(401).json({ error: 'USUARIO_INACTIVO' });
  }

  const tenant = await Tenant.findById(user.tenantId);
  if (!tenant || !tenant.activo) {
    return res.status(403).json({ error: 'TENANT_INACTIVO' });
  }

  req.user = user;
  req.tenant = tenant;
  next();
}

/** Restringe una ruta a ciertos roles. */
function exigirRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.rol)) {
      return res.status(403).json({
        error: 'SIN_PERMISO',
        mensaje: `Requiere rol: ${roles.join(' o ')}`,
      });
    }
    next();
  };
}

/** Duración de la sesión en milisegundos, para que el panel arme sus avisos. */
const DURACION_SESION_MS = 60 * 60 * 1000;

module.exports = {
  DURACION_SESION_MS,
  hashPassword,
  verificarPassword,
  generarApiKey,
  autenticarApiKey,
  autenticarUsuario,
  firmarToken,
  exigirRol,
};
