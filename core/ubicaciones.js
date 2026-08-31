/**
 * ubicaciones.js — Codificación territorial (Nota 14 del Anexo v4.4)
 * -----------------------------------------------------------------------------
 * El comprobante guarda códigos: provincia "1", cantón "02", distrito "03".
 * El PDF debe imprimir nombres (nota 7), así que hace falta esta traducción.
 *
 * ALCANCE: se incluyen las 7 provincias, los 84 cantones y los 479 distritos
 * de la División Territorial Administrativa. Los distritos vienen de una base
 * de datos abierta (ver el comentario junto a DISTRITOS más abajo), con los
 * cantones creados después de esa publicación agregados a mano.
 * -----------------------------------------------------------------------------
 */

'use strict';

const PROVINCIAS = {
  1: 'San José',
  2: 'Alajuela',
  3: 'Cartago',
  4: 'Heredia',
  5: 'Guanacaste',
  6: 'Puntarenas',
  7: 'Limón',
};

const CANTONES = {
  1: {
    1: 'San José', 2: 'Escazú', 3: 'Desamparados', 4: 'Puriscal', 5: 'Tarrazú',
    6: 'Aserrí', 7: 'Mora', 8: 'Goicoechea', 9: 'Santa Ana', 10: 'Alajuelita',
    11: 'Vázquez de Coronado', 12: 'Acosta', 13: 'Tibás', 14: 'Moravia',
    15: 'Montes de Oca', 16: 'Turrubares', 17: 'Dota', 18: 'Curridabat',
    19: 'Pérez Zeledón', 20: 'León Cortés Castro',
  },
  2: {
    1: 'Alajuela', 2: 'San Ramón', 3: 'Grecia', 4: 'San Mateo', 5: 'Atenas',
    6: 'Naranjo', 7: 'Palmares', 8: 'Poás', 9: 'Orotina', 10: 'San Carlos',
    11: 'Zarcero', 12: 'Sarchí', 13: 'Upala', 14: 'Los Chiles', 15: 'Guatuso',
    16: 'Río Cuarto',
  },
  3: {
    1: 'Cartago', 2: 'Paraíso', 3: 'La Unión', 4: 'Jiménez', 5: 'Turrialba',
    6: 'Alvarado', 7: 'Oreamuno', 8: 'El Guarco',
  },
  4: {
    1: 'Heredia', 2: 'Barva', 3: 'Santo Domingo', 4: 'Santa Bárbara',
    5: 'San Rafael', 6: 'San Isidro', 7: 'Belén', 8: 'Flores', 9: 'San Pablo',
    10: 'Sarapiquí',
  },
  5: {
    1: 'Liberia', 2: 'Nicoya', 3: 'Santa Cruz', 4: 'Bagaces', 5: 'Carrillo',
    6: 'Cañas', 7: 'Abangares', 8: 'Tilarán', 9: 'Nandayure', 10: 'La Cruz',
    11: 'Hojancha',
  },
  6: {
    1: 'Puntarenas', 2: 'Esparza', 3: 'Buenos Aires', 4: 'Montes de Oro',
    5: 'Osa', 6: 'Quepos', 7: 'Golfito', 8: 'Coto Brus', 9: 'Parrita',
    10: 'Corredores', 11: 'Garabito', 12: 'Monteverde', 13: 'Puerto Jiménez',
  },
  7: {
    1: 'Limón', 2: 'Pococí', 3: 'Siquirres', 4: 'Talamanca', 5: 'Matina',
    6: 'Guácimo',
  },
};

/**
 * Distritos (nota 14 del Anexo, igual que provincias y cantones).
 * Fuente: "Divisiones territoriales de Costa Rica" (investigacion/divisiones-territoriales-data,
 * licencia ODC-BY), con los 3 cantones creados después de esa publicación agregados a mano:
 * Río Cuarto (Alajuela, 2018), Monteverde y Puerto Jiménez (Puntarenas, 2021 y 2022).
 * Estructura: DISTRITOS['1-1-1'] = 'Carmen'
 */
const DISTRITOS = {
  '1-1-1': "Carmen", '1-1-2': "Merced", '1-1-3': "Hospital", '1-1-4': "Catedral", '1-1-5': "Zapote", '1-1-6': "San Francisco de Dos Ríos", '1-1-7': "Uruca", '1-1-8': "Mata Redonda", '1-1-9': "Pavas", '1-1-10': "Hatillo", '1-1-11': "San Sebastián",
  '1-2-1': "Escazú", '1-2-2': "San Antonio", '1-2-3': "San Rafael",
  '1-3-1': "Desamparados", '1-3-2': "San Miguel", '1-3-3': "San Juan de Dios", '1-3-4': "San Rafael Arriba", '1-3-5': "San Antonio", '1-3-6': "Frailes", '1-3-7': "Patarrá", '1-3-8': "San Cristóbal", '1-3-9': "Rosario", '1-3-10': "Damas", '1-3-11': "San Rafael Abajo", '1-3-12': "Gravilias", '1-3-13': "Los Guido",
  '1-4-1': "Santiago", '1-4-2': "Mercedes Sur", '1-4-3': "Barbacoas", '1-4-4': "Grifo Alto", '1-4-5': "San Rafael", '1-4-6': "Candelarita", '1-4-7': "Desamparaditos", '1-4-8': "San Antonio", '1-4-9': "Chires",
  '1-5-1': "San Marcos", '1-5-2': "San Lorenzo", '1-5-3': "San Carlos",
  '1-6-1': "Aserrí", '1-6-2': "Tarbaca", '1-6-3': "Vuelta de Jorco", '1-6-4': "San Gabriel", '1-6-5': "Legua", '1-6-6': "Monterrey", '1-6-7': "Salitrillos",
  '1-7-1': "Colón", '1-7-2': "Guayabo", '1-7-3': "Tabarcia", '1-7-4': "Piedras Negras", '1-7-5': "Picagres", '1-7-6': "Jaris",
  '1-8-1': "Guadalupe", '1-8-2': "San Francisco", '1-8-3': "Calle Blancos", '1-8-4': "Mata de Plátano", '1-8-5': "Ipís", '1-8-6': "Rancho Redondo", '1-8-7': "Purral",
  '1-9-1': "Santa Ana", '1-9-2': "Salitral", '1-9-3': "Pozos", '1-9-4': "Uruca", '1-9-5': "Piedades", '1-9-6': "Brasil",
  '1-10-1': "Alajuelita", '1-10-2': "San Josecito", '1-10-3': "San Antonio", '1-10-4': "Concepción", '1-10-5': "San Felipe",
  '1-11-1': "San Isidro", '1-11-2': "San Rafael", '1-11-3': "Dulce Nombre de Jesús", '1-11-4': "Patalillo", '1-11-5': "Cascajal",
  '1-12-1': "San Ignacio", '1-12-2': "Guaitil", '1-12-3': "Palmichal", '1-12-4': "Cangrejal", '1-12-5': "Sabanillas",
  '1-13-1': "San Juan", '1-13-2': "Cinco Esquinas", '1-13-3': "Anselmo Llorente", '1-13-4': "León XIII", '1-13-5': "Colima",
  '1-14-1': "San Vicente", '1-14-2': "San Jerónimo", '1-14-3': "La Trinidad",
  '1-15-1': "San Pedro", '1-15-2': "Sabanilla", '1-15-3': "Mercedes", '1-15-4': "San Rafael",
  '1-16-1': "San Pablo", '1-16-2': "San Pedro", '1-16-3': "San Juan de Mata", '1-16-4': "San Luis", '1-16-5': "Carara",
  '1-17-1': "Santa María", '1-17-2': "Jardín", '1-17-3': "Copey",
  '1-18-1': "Curridabat", '1-18-2': "Granadilla", '1-18-3': "Sánchez", '1-18-4': "Tirrases",
  '1-19-1': "San Isidro de El General", '1-19-2': "General", '1-19-3': "Daniel Flores", '1-19-4': "Rivas", '1-19-5': "San Pedro", '1-19-6': "Platanares", '1-19-7': "Pejibaye", '1-19-8': "Cajón", '1-19-9': "Barú", '1-19-10': "Río Nuevo", '1-19-11': "Páramo",
  '1-20-1': "San Pablo", '1-20-2': "San Andrés", '1-20-3': "Llano Bonito", '1-20-4': "San Isidro", '1-20-5': "Santa Cruz", '1-20-6': "San Antonio",
  '2-1-1': "Alajuela", '2-1-2': "San José", '2-1-3': "Carrizal", '2-1-4': "San Antonio", '2-1-5': "Guácima", '2-1-6': "San Isidro", '2-1-7': "Sabanilla", '2-1-8': "San Rafael", '2-1-9': "Río Segundo", '2-1-10': "Desamparados", '2-1-11': "Turrúcares", '2-1-12': "Tambor", '2-1-13': "Garita", '2-1-14': "Sarapiquí",
  '2-2-1': "San Ramón", '2-2-2': "Santiago", '2-2-3': "San Juan", '2-2-4': "Piedades Norte", '2-2-5': "Piedades Sur", '2-2-6': "San Rafael", '2-2-7': "San Isidro", '2-2-8': "Los Ángeles", '2-2-9': "Alfaro", '2-2-10': "Volio", '2-2-11': "Concepción", '2-2-12': "Zapotal", '2-2-13': "Peñas Blancas",
  '2-3-1': "Grecia", '2-3-2': "San Isidro", '2-3-3': "San José", '2-3-4': "San Roque", '2-3-5': "Tacares", '2-3-6': "Río Cuarto", '2-3-7': "Puente de Piedra", '2-3-8': "Bolívar",
  '2-4-1': "San Mateo", '2-4-2': "Desmonte", '2-4-3': "Jesús María",
  '2-5-1': "Atenas", '2-5-2': "Jesús", '2-5-3': "Mercedes", '2-5-4': "San Isidro", '2-5-5': "Concepción", '2-5-6': "San José", '2-5-7': "Santa Eulalia", '2-5-8': "Escobal",
  '2-6-1': "Naranjo", '2-6-2': "San Miguel", '2-6-3': "San José", '2-6-4': "Cirrí Sur", '2-6-5': "San Jerónimo", '2-6-6': "San Juan", '2-6-7': "El Rosario", '2-6-8': "Palmitos",
  '2-7-1': "Palmares", '2-7-2': "Zaragoza", '2-7-3': "Buenos Aires", '2-7-4': "Santiago", '2-7-5': "Candelaria", '2-7-6': "Esquipulas", '2-7-7': "La Granja",
  '2-8-1': "San Pedro", '2-8-2': "San Juan", '2-8-3': "San Rafael", '2-8-4': "Carrillos", '2-8-5': "Sabana Redonda",
  '2-9-1': "Orotina", '2-9-2': "El Mastate", '2-9-3': "Hacienda Vieja", '2-9-4': "Coyolar", '2-9-5': "La Ceiba",
  '2-10-1': "Quesada", '2-10-2': "Florencia", '2-10-3': "Buenavista", '2-10-4': "Aguas Zarcas", '2-10-5': "Venecia", '2-10-6': "Pital", '2-10-7': "La Fortuna", '2-10-8': "La Tigra", '2-10-9': "La Palmera", '2-10-10': "Venado", '2-10-11': "Cutris", '2-10-12': "Monterrey", '2-10-13': "Pocosol",
  '2-11-1': "Zarcero", '2-11-2': "Laguna", '2-11-3': "Tapesco", '2-11-4': "Guadalupe", '2-11-5': "Palmira", '2-11-6': "Zapote", '2-11-7': "Brisas",
  '2-12-1': "Sarchí Norte", '2-12-2': "Sarchí Sur", '2-12-3': "Toro Amarillo", '2-12-4': "San Pedro", '2-12-5': "Rodríguez",
  '2-13-1': "Upala", '2-13-2': "Aguas Claras", '2-13-3': "San José (Pizote)", '2-13-4': "Bijagua", '2-13-5': "Delicias", '2-13-6': "Dos Ríos", '2-13-7': "Yoliyllal",
  '2-14-1': "Los Chiles", '2-14-2': "Caño Negro", '2-14-3': "El Amparo", '2-14-4': "San Jorge",
  '2-15-1': "San Rafael", '2-15-2': "Buenavista", '2-15-3': "Cote", '2-15-4': "Katira",
  '2-16-1': "Río Cuarto", '2-16-2': "Santa Rita", '2-16-3': "Santa Isabel",
  '3-1-1': "Oriental", '3-1-2': "Occidental", '3-1-3': "Carmen", '3-1-4': "San Nicolás", '3-1-5': "Aguacaliente (San Francisco)", '3-1-6': "Guadalupe (Arenilla)", '3-1-7': "Corralillo", '3-1-8': "Tierra Blanca", '3-1-9': "Dulce Nombre", '3-1-10': "Llano Grande", '3-1-11': "Quebradilla",
  '3-2-1': "Paraíso", '3-2-2': "Santiago", '3-2-3': "Orosi", '3-2-4': "Cachí", '3-2-5': "Llanos de Santa Lucía",
  '3-3-1': "Tres Ríos", '3-3-2': "San Diego", '3-3-3': "San Juan", '3-3-4': "San Rafael", '3-3-5': "Concepción", '3-3-6': "Dulce Nombre", '3-3-7': "San Ramón", '3-3-8': "Río Azul",
  '3-4-1': "Juan Viñas", '3-4-2': "Tucurrique", '3-4-3': "Pejibaye",
  '3-5-1': "Turrialba", '3-5-2': "La Suiza", '3-5-3': "Peralta", '3-5-4': "Santa Cruz", '3-5-5': "Santa Teresita", '3-5-6': "Pavones", '3-5-7': "Tuis", '3-5-8': "Tayutic", '3-5-9': "Santa Rosa", '3-5-10': "Tres Equis", '3-5-11': "La Isabel", '3-5-12': "Chirripó",
  '3-6-1': "Pacayas", '3-6-2': "Cervantes", '3-6-3': "Capellades",
  '3-7-1': "San Rafael", '3-7-2': "Cot", '3-7-3': "Potrero Cerrado", '3-7-4': "Cipreses", '3-7-5': "Santa Rosa",
  '3-8-1': "El Tejar", '3-8-2': "San Isidro", '3-8-3': "Tobosi", '3-8-4': "Patio de Agua",
  '4-1-1': "Heredia", '4-1-2': "Mercedes", '4-1-3': "San Francisco", '4-1-4': "Ulloa", '4-1-5': "Varablanca",
  '4-2-1': "Barva", '4-2-2': "San Pedro", '4-2-3': "San Pablo", '4-2-4': "San Roque", '4-2-5': "Santa Lucía", '4-2-6': "San José de la Montaña",
  '4-3-1': "Santo Domingo", '4-3-2': "San Vicente", '4-3-3': "San Miguel", '4-3-4': "Paracito", '4-3-5': "Santo Tomás", '4-3-6': "Santa Rosa", '4-3-7': "Tures", '4-3-8': "Para",
  '4-4-1': "Santa Bárbara", '4-4-2': "San Pedro", '4-4-3': "San Juan", '4-4-4': "Jesús", '4-4-5': "Santo Domingo", '4-4-6': "Puraba",
  '4-5-1': "San Rafael", '4-5-2': "San Josécito", '4-5-3': "Santiago", '4-5-4': "Los Ángeles", '4-5-5': "Concepción",
  '4-6-1': "San Isidro", '4-6-2': "San José", '4-6-3': "Concepción", '4-6-4': "San Francisco",
  '4-7-1': "San Antonio", '4-7-2': "La Ribera", '4-7-3': "La Asunción",
  '4-8-1': "San Joaquín de Flores", '4-8-2': "Barrantes", '4-8-3': "Llorente",
  '4-9-1': "San Pablo", '4-9-2': "Rincón de Sabanilla",
  '4-10-1': "Puerto Viejo", '4-10-2': "La Virgen", '4-10-3': "Horquetas", '4-10-4': "Llanuras del Gaspar", '4-10-5': "Cureña",
  '5-1-1': "Liberia", '5-1-2': "Cañas Dulces", '5-1-3': "Mayorga", '5-1-4': "Nacascolo", '5-1-5': "Curubande",
  '5-2-1': "Nicoya", '5-2-2': "Mansion", '5-2-3': "San Antonio", '5-2-4': "Quebrada Honda", '5-2-5': "Samara", '5-2-6': "Nosara", '5-2-7': "Belén de Nosarita",
  '5-3-1': "Santa Cruz", '5-3-2': "Bolson", '5-3-3': "Veintisiete de Abril", '5-3-4': "Tempate", '5-3-5': "Cartagena", '5-3-6': "Cuajiniquil", '5-3-7': "Diria", '5-3-8': "Cabo Velas", '5-3-9': "Tamarindo",
  '5-4-1': "Bagaces", '5-4-2': "Fortuna", '5-4-3': "Mogote", '5-4-4': "Río Naranjo",
  '5-5-1': "Filadelfia", '5-5-2': "Palmira", '5-5-3': "Sardinal", '5-5-4': "Belén",
  '5-6-1': "Cañas", '5-6-2': "Palmira", '5-6-3': "San Miguel", '5-6-4': "Bebedero", '5-6-5': "Porozal",
  '5-7-1': "Juntas", '5-7-2': "Sierra", '5-7-3': "San Juan", '5-7-4': "Colorado",
  '5-8-1': "Tilarán", '5-8-2': "Quebrada Grande", '5-8-3': "Tronadora", '5-8-4': "Santa Rosa", '5-8-5': "Líbano", '5-8-6': "Tierras Morenas", '5-8-7': "Arenal",
  '5-9-1': "Carmona", '5-9-2': "Santa Rita", '5-9-3': "Zapotal", '5-9-4': "San Pablo", '5-9-5': "Porvenir", '5-9-6': "Bejuco",
  '5-10-1': "La Cruz", '5-10-2': "Santa Cecilia", '5-10-3': "Garita", '5-10-4': "Santa Elena",
  '5-11-1': "Hojancha", '5-11-2': "Monte Romo", '5-11-3': "Puerto Carrillo", '5-11-4': "Huacas",
  '6-1-1': "Puntarenas", '6-1-2': "Pitahaya", '6-1-3': "Chomes", '6-1-4': "Lepanto", '6-1-5': "Paquera", '6-1-6': "Manzanillo", '6-1-7': "Guacimal", '6-1-8': "Barranca", '6-1-9': "Monte Verde", '6-1-10': "Isla del Coco", '6-1-11': "Cobano", '6-1-12': "Chacarita", '6-1-13': "Chira", '6-1-14': "Acapulco", '6-1-15': "El Roble", '6-1-16': "Arancibia",
  '6-2-1': "Espiritu Santo", '6-2-2': "San Juan Grande", '6-2-3': "Macacona", '6-2-4': "San Rafael", '6-2-5': "San Jerónimo",
  '6-3-1': "Buenos Aires", '6-3-2': "Volcan", '6-3-3': "Potrero Grande", '6-3-4': "Boruca", '6-3-5': "Pilas", '6-3-6': "Colinas", '6-3-7': "Changena", '6-3-8': "Briolley", '6-3-9': "Brunka",
  '6-4-1': "Miramar", '6-4-2': "La Unión", '6-4-3': "San Isidro",
  '6-5-1': "Puerto Cortes", '6-5-2': "Palmar", '6-5-3': "Sierpe", '6-5-4': "Bahia Ballena", '6-5-5': "Piedras Blancas",
  '6-6-1': "Quepos", '6-6-2': "Savegre", '6-6-3': "Naranjito",
  '6-7-1': "Golfito", '6-7-2': "Puerto Jiménez", '6-7-3': "Guaycara", '6-7-4': "Pavon",
  '6-8-1': "San Vito", '6-8-2': "Sabalito", '6-8-3': "Aguabuena", '6-8-4': "Limóncito", '6-8-5': "Pittier",
  '6-9-1': "Parrita",
  '6-10-1': "Corredor", '6-10-2': "La Cuesta", '6-10-3': "Canoas", '6-10-4': "Laurel",
  '6-11-1': "Jacó", '6-11-2': "Tarcoles",
  '6-12-1': "Monteverde",
  '6-13-1': "Puerto Jiménez",
  '7-1-1': "Limón", '7-1-2': "Valle La Estrella", '7-1-3': "Río Blanco", '7-1-4': "Matama",
  '7-2-1': "Guapiles", '7-2-2': "Jiménez", '7-2-3': "Rita", '7-2-4': "Roxana", '7-2-5': "Cariari", '7-2-6': "Colorado",
  '7-3-1': "Siquirres", '7-3-2': "Pacuarito", '7-3-3': "Florida", '7-3-4': "Germania", '7-3-5': "Cairo", '7-3-6': "Alegria",
  '7-4-1': "Bratsi", '7-4-2': "Sixaola", '7-4-3': "Cahuita", '7-4-4': "Telire",
  '7-5-1': "Matina", '7-5-2': "Battan", '7-5-3': "Carrandi",
  '7-6-1': "Guácimo", '7-6-2': "Mercedes", '7-6-3': "Pocora", '7-6-4': "Río Jiménez", '7-6-5': "Duacari",
};

/**
 * Permite cargar/corregir distritos puntuales sin tocar código -- por ejemplo, si la División
 * Territorial Administrativa vuelve a cambiar (pasa con cierta frecuencia, ver el encabezado de
 * este archivo). No hace falta para el uso normal: DISTRITOS ya viene completo.
 * @param {object} mapa  { '1-1-1': 'Carmen', ... }
 */
function cargarDistritos(mapa) {
  Object.assign(DISTRITOS, mapa);
  return Object.keys(DISTRITOS).length;
}

const n = (v) => Number(String(v ?? '').replace(/^0+/, '') || 0);

function nombreProvincia(codigo) {
  return PROVINCIAS[n(codigo)] || null;
}

function nombreCanton(provincia, canton) {
  return CANTONES[n(provincia)]?.[n(canton)] || null;
}

function nombreDistrito(provincia, canton, distrito) {
  return DISTRITOS[`${n(provincia)}-${n(canton)}-${n(distrito)}`] || null;
}

/**
 * Resuelve los tres nombres de una ubicación.
 * Devuelve null en lo que no se pueda resolver; el renderer decide si imprime
 * el código o lo omite. Nunca inventa un nombre.
 */
function resolver(ubicacion) {
  if (!ubicacion) return {};
  const { provincia, canton, distrito } = ubicacion;
  return {
    provincia: nombreProvincia(provincia),
    canton: nombreCanton(provincia, canton),
    distrito: nombreDistrito(provincia, canton, distrito),
  };
}

/** Opciones para los selectores del panel. */
function opcionesProvincias() {
  return Object.entries(PROVINCIAS).map(([codigo, nombre]) => ({ codigo, nombre }));
}

function opcionesCantones(provincia) {
  const tabla = CANTONES[n(provincia)] || {};
  return Object.entries(tabla).map(([codigo, nombre]) => ({
    codigo: String(codigo).padStart(2, '0'),
    nombre,
  }));
}

function opcionesDistritos(provincia, canton) {
  const prefijo = `${n(provincia)}-${n(canton)}-`;
  return Object.entries(DISTRITOS)
    .filter(([clave]) => clave.startsWith(prefijo))
    .map(([clave, nombre]) => ({
      codigo: clave.slice(prefijo.length).padStart(2, '0'),
      nombre,
    }))
    .sort((a, b) => Number(a.codigo) - Number(b.codigo));
}

module.exports = {
  PROVINCIAS,
  CANTONES,
  DISTRITOS,
  cargarDistritos,
  nombreProvincia,
  nombreCanton,
  nombreDistrito,
  resolver,
  opcionesProvincias,
  opcionesCantones,
  opcionesDistritos,
};
