# Montacargas y Servicios MR — Sistema Administrativo

Sistema administrativo en la nube para PYMES: **Facturación y Cobranza**.
Construido con Next.js (Node.js) + MySQL, sin Docker.

## Módulos

- **Inicio** — KPIs del mes (facturado, cobrado, saldo por cobrar, vencido, por vencer) y cobranza urgente.
- **Facturas** — cabecera + detalle de productos; subtotal, IVA y total calculados automáticamente; folio consecutivo automático; cancelación de facturas.
- **Cobranza** — múltiples pagos por factura; Total Cobrado, Saldo Pendiente y Estado de Cobro automáticos (Al corriente / Por vencer / Pago parcial / Vencida / Pagada).
- **Clientes / Proveedores** — catálogos maestros con condiciones de crédito.
- **Productos** — SKU, marca, línea, unidad, proveedor, costo, precio y margen (stock preparado para versión futura).
- **Catálogos** — formas de pago, bancos, marcas, líneas, unidades y vendedores.
- **Configuración** — datos de empresa, IVA configurable, días de alerta de cobranza y serie de folio.

## Requisitos

- Node.js 18+
- MySQL accesible (configurado en `.env`)

## Instalación

```bash
npm install
npm run setup-db    # crea la base BDMontacargas, tablas y datos semilla
npm run dev         # desarrollo en http://localhost:3020
```

Producción:

```bash
npm run build
npm start           # producción en http://localhost:3021
```

## Configuración (.env)

```
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=BDMontacargas
DB_PORT=3306
```

## Acceso inicial

- Usuario: `admin`
- Contraseña: `admin`

(Usuarios en la tabla `usuarios`; se recomienda cambiar la contraseña.)

## Logo

El logo vectorial está en `public/logo.svg` (login) y `public/logo-mark.svg` (encabezado).
Si deseas usar el archivo original de la empresa, reemplaza esos archivos.
