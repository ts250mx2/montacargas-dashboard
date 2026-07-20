/**
 * Setup de la base de datos BDMontacargas.
 * Crea la base (si no existe), todas las tablas y datos semilla.
 * Ejecutar con: npm run setup-db
 */
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Carga manual del .env (sin dependencias extra)
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const DB_NAME = process.env.DB_NAME || 'BDMontacargas';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306'),
    multipleStatements: true,
  });

  console.log(`Conectado a ${process.env.DB_HOST}. Creando base ${DB_NAME}...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${DB_NAME}\``);

  const tablas: string[] = [
    `CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      login VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS configuracion (
      id INT PRIMARY KEY,
      nombre_empresa VARCHAR(150) NOT NULL DEFAULT '',
      rfc VARCHAR(20) NOT NULL DEFAULT '',
      domicilio VARCHAR(300) NOT NULL DEFAULT '',
      telefono VARCHAR(30) NOT NULL DEFAULT '',
      correo VARCHAR(100) NOT NULL DEFAULT '',
      iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 16.00,
      dias_alerta INT NOT NULL DEFAULT 7,
      serie_folio VARCHAR(10) NOT NULL DEFAULT 'F'
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS formas_pago (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS bancos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS marcas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS lineas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS unidades (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      abreviatura VARCHAR(10) NOT NULL DEFAULT '',
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS vendedores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      telefono VARCHAR(30) NOT NULL DEFAULT '',
      correo VARCHAR(100) NOT NULL DEFAULT '',
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS clientes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      razon_social VARCHAR(200) NOT NULL,
      rfc VARCHAR(20) NOT NULL DEFAULT '',
      contacto VARCHAR(100) NOT NULL DEFAULT '',
      telefono VARCHAR(30) NOT NULL DEFAULT '',
      correo VARCHAR(100) NOT NULL DEFAULT '',
      domicilio VARCHAR(300) NOT NULL DEFAULT '',
      dias_credito INT NOT NULL DEFAULT 0,
      limite_credito DECIMAL(12,2) NOT NULL DEFAULT 0,
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS proveedores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      razon_social VARCHAR(200) NOT NULL,
      rfc VARCHAR(20) NOT NULL DEFAULT '',
      contacto VARCHAR(100) NOT NULL DEFAULT '',
      telefono VARCHAR(30) NOT NULL DEFAULT '',
      correo VARCHAR(100) NOT NULL DEFAULT '',
      domicilio VARCHAR(300) NOT NULL DEFAULT '',
      dias_credito INT NOT NULL DEFAULT 0,
      limite_credito DECIMAL(12,2) NOT NULL DEFAULT 0,
      activo TINYINT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS productos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sku VARCHAR(50) NOT NULL,
      descripcion VARCHAR(300) NOT NULL,
      id_marca INT NULL,
      id_linea INT NULL,
      id_unidad INT NULL,
      id_proveedor INT NULL,
      costo DECIMAL(12,2) NOT NULL DEFAULT 0,
      precio DECIMAL(12,2) NOT NULL DEFAULT 0,
      stock DECIMAL(12,2) NOT NULL DEFAULT 0,
      activo TINYINT NOT NULL DEFAULT 1,
      UNIQUE KEY uq_sku (sku),
      KEY idx_marca (id_marca),
      KEY idx_linea (id_linea)
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS facturas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      folio VARCHAR(20) NOT NULL,
      folio_interno VARCHAR(50) NOT NULL DEFAULT '',
      fecha DATE NOT NULL,
      id_cliente INT NOT NULL,
      id_vendedor INT NULL,
      id_forma_pago INT NULL,
      fecha_vencimiento DATE NOT NULL,
      estado ENUM('Vigente','Cancelada') NOT NULL DEFAULT 'Vigente',
      iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 16.00,
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
      iva DECIMAL(12,2) NOT NULL DEFAULT 0,
      total DECIMAL(12,2) NOT NULL DEFAULT 0,
      notas VARCHAR(300) NOT NULL DEFAULT '',
      UNIQUE KEY uq_folio (folio),
      KEY idx_cliente (id_cliente),
      KEY idx_fecha (fecha),
      KEY idx_folio_interno (folio_interno)
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS factura_detalle (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_factura INT NOT NULL,
      id_producto INT NOT NULL,
      cantidad DECIMAL(12,2) NOT NULL DEFAULT 1,
      precio DECIMAL(12,2) NOT NULL DEFAULT 0,
      descuento DECIMAL(5,2) NOT NULL DEFAULT 0,
      importe DECIMAL(12,2) NOT NULL DEFAULT 0,
      costo DECIMAL(12,2) NOT NULL DEFAULT 0,
      KEY idx_factura (id_factura),
      KEY idx_producto (id_producto)
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS pagos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fecha DATE NOT NULL,
      id_factura INT NOT NULL,
      id_forma_pago INT NULL,
      id_banco INT NULL,
      referencia VARCHAR(100) NOT NULL DEFAULT '',
      importe DECIMAL(12,2) NOT NULL DEFAULT 0,
      KEY idx_factura (id_factura),
      KEY idx_fecha (fecha)
    ) ENGINE=InnoDB`,
  ];

  for (const sql of tablas) {
    await conn.query(sql);
  }
  console.log('Tablas creadas/verificadas.');

  // ── Migraciones idempotentes para bases ya existentes ──
  const columnExists = async (tabla: string, columna: string) => {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tabla, columna]
    );
    return (rows as any[])[0].n > 0;
  };
  const indexExists = async (tabla: string, indice: string) => {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [tabla, indice]
    );
    return (rows as any[])[0].n > 0;
  };

  if (!(await columnExists('facturas', 'folio_interno'))) {
    await conn.query(`ALTER TABLE facturas ADD COLUMN folio_interno VARCHAR(50) NOT NULL DEFAULT '' AFTER folio`);
    console.log('Migración: columna facturas.folio_interno agregada.');
  }
  if (!(await indexExists('facturas', 'idx_folio_interno'))) {
    await conn.query(`ALTER TABLE facturas ADD INDEX idx_folio_interno (folio_interno)`);
    console.log('Migración: índice facturas.idx_folio_interno agregado.');
  }

  // ── Datos semilla (solo si las tablas están vacías) ──
  const seed = async (tabla: string, insert: string) => {
    const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM ${tabla}`);
    if ((rows as any[])[0].n === 0) {
      await conn.query(insert);
      console.log(`Semilla insertada en ${tabla}`);
    }
  };

  await seed('usuarios', `INSERT INTO usuarios (nombre, login, password) VALUES ('Administrador', 'admin', 'admin')`);

  await seed('configuracion', `INSERT INTO configuracion (id, nombre_empresa, iva_porcentaje, dias_alerta, serie_folio)
    VALUES (1, 'Montacargas y Servicios MR', 16.00, 7, 'F')`);

  await seed('formas_pago', `INSERT INTO formas_pago (nombre) VALUES
    ('Efectivo'), ('Transferencia'), ('Tarjeta de Crédito'), ('Tarjeta de Débito'), ('Cheque'), ('Crédito')`);

  await seed('bancos', `INSERT INTO bancos (nombre) VALUES
    ('BBVA'), ('Banorte'), ('Santander'), ('Citibanamex'), ('HSBC'), ('Scotiabank'), ('Banco del Bajío'), ('Banregio'), ('Otro')`);

  await seed('marcas', `INSERT INTO marcas (nombre) VALUES
    ('Toyota'), ('Yale'), ('Hyster'), ('Caterpillar'), ('Nissan'), ('Mitsubishi'),
    ('Komatsu'), ('Clark'), ('Crown'), ('Raymond'), ('TCM'), ('Doosan'), ('Genérica')`);

  await seed('lineas', `INSERT INTO lineas (nombre) VALUES
    ('Motor'), ('Transmisión'), ('Sistema Hidráulico'), ('Frenos'), ('Dirección'),
    ('Sistema Eléctrico'), ('Llantas y Ruedas'), ('Mástil'), ('Horquillas'),
    ('Filtros'), ('Aceites y Lubricantes'), ('Baterías'), ('Asientos y Cabina'),
    ('Refacciones Generales'), ('Servicio y Mano de Obra')`);

  await seed('unidades', `INSERT INTO unidades (nombre, abreviatura) VALUES
    ('Pieza', 'PZA'), ('Juego', 'JGO'), ('Kit', 'KIT'), ('Par', 'PAR'),
    ('Litro', 'LT'), ('Metro', 'MT'), ('Kilogramo', 'KG'), ('Servicio', 'SRV')`);

  await seed('vendedores', `INSERT INTO vendedores (nombre) VALUES ('Mostrador')`);

  await conn.end();
  console.log('✔ Base de datos lista.');
}

main().catch(err => {
  console.error('Error en setup:', err.message);
  process.exit(1);
});
