# Billing Kilometer

Plataforma SaaS que emite comprobantes en PDF personalizables, con la estructura
de datos de del Ministerio de Hacienda de Costa Rica.

## Instalación

```bash
# Backend
cd server
npm install
cp .env.example .env        # generar JWT_SECRET
npm run seed                # imprime la API key UNA sola vez
npm run dev                 # http://localhost:3000

# Panel
cd web
npm install
npm run dev                 # http://localhost:5173
```

El seed crea un club de ejemplo. Panel: `admin@clubejemplo.cr` / `cambiar123`.

### Adaptadores

Cada aplicación cliente nombra sus campos como quiere. El adaptador traduce ese
JSON al comprobante canónico, y vive en base de datos como configuración: sumar
un cliente no requiere desplegar.

Hay 8 predefinidos en dos moldes, porque estructuralmente solo existen dos:

- **Sin líneas de detalle** — el cobro va en "otros cargos" (nota 16). Multas,
  intereses moratorios, depósitos de garantía.
- **Con líneas** — cada concepto es una línea con cantidad, precio e impuesto.
  Productos, mensualidades, servicios profesionales, suscripciones, reservas.

La variedad está en los valores por defecto de cada rubro (CAByS, unidad de
medida, tarifa, campos no fiscales), no en la estructura.

Cada adaptador trae un `ejemploEntrada` que alimenta tres cosas: la vista previa
del editor, el probador de Integración y el código de ejemplo de la ficha del
diseño. Si el adaptador cambia, los tres cambian con él y no queda documentación
mintiendo.

### Sesión

Dura una hora y se renueva sola mientras el usuario esté activo, así que en la
práctica funciona como inactividad máxima. A los 50 minutos aparece un aviso con
cuenta regresiva; a los 60 se cierra. La renovación se limita a una cada cinco
minutos para que mover el mouse no dispare una petición por evento.

## Pendientes

- Distritos de la nota 14 (más de 480; se cargan del archivo oficial con
  `cargarDistritos()`)
- Nodo `DetalleSurtido` para combos con tarifas de IVA mixtas
- Pruebas automatizadas del core
- Límite de peticiones por llave
