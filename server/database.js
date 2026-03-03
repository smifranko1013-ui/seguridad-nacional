import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'seguridad_nacional.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read/write
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    category TEXT DEFAULT 'General',
    barcode_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    position TEXT DEFAULT '',
    department TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    signature_data TEXT,
    delivered_by TEXT DEFAULT 'Sistema',
    notes TEXT DEFAULT '',
    pdf_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    status TEXT DEFAULT 'activo',
    change_reason TEXT DEFAULT '',
    observations TEXT DEFAULT '',
    last_change_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    replacement_id INTEGER,
    replaced_assignment_id INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    returned_at DATETIME,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_deliveries_product ON deliveries(product_id);
  CREATE INDEX IF NOT EXISTS idx_deliveries_employee ON deliveries(employee_id);
  CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(created_at);
  CREATE INDEX IF NOT EXISTS idx_assignments_employee ON assignments(employee_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
  CREATE INDEX IF NOT EXISTS idx_assignments_product ON assignments(product_id);
`);

// Seed some sample data if the database is empty
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (productCount.count === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (code, name, quantity, category, barcode_data)
    VALUES (?, ?, ?, ?, ?)
  `);

  const sampleProducts = [
    ['SN-UNI-001', 'Uniforme Táctico Completo', 45, 'Uniformes', 'SN-UNI-001'],
    ['SN-UNI-002', 'Camisa Polo Institucional', 8, 'Uniformes', 'SN-UNI-002'],
    ['SN-UNI-003', 'Pantalón Cargo Negro', 15, 'Uniformes', 'SN-UNI-003'],
    ['SN-RAD-001', 'Radio Motorola EP450', 12, 'Comunicaciones', 'SN-RAD-001'],
    ['SN-RAD-002', 'Auricular de Vigilancia', 5, 'Comunicaciones', 'SN-RAD-002'],
    ['SN-RAD-003', 'Batería Radio Repuesto', 22, 'Comunicaciones', 'SN-RAD-003'],
    ['SN-DEF-001', 'Chaleco Antibalas Nivel III', 3, 'Defensa', 'SN-DEF-001'],
    ['SN-DEF-002', 'Bastón PR-24', 18, 'Defensa', 'SN-DEF-002'],
    ['SN-DEF-003', 'Esposas Metálicas', 30, 'Defensa', 'SN-DEF-003'],
    ['SN-TEC-001', 'Linterna Táctica LED', 25, 'Tecnología', 'SN-TEC-001'],
    ['SN-TEC-002', 'Cámara Corporal HD', 7, 'Tecnología', 'SN-TEC-002'],
    ['SN-TEC-003', 'GPS Vehicular', 14, 'Tecnología', 'SN-TEC-003'],
    ['SN-PRO-001', 'Botas Tácticas Par', 19, 'Protección', 'SN-PRO-001'],
    ['SN-PRO-002', 'Casco Protector', 11, 'Protección', 'SN-PRO-002'],
    ['SN-PRO-003', 'Guantes Tácticos Par', 35, 'Protección', 'SN-PRO-003'],
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertProduct.run(...item);
    }
  });
  insertMany(sampleProducts);

  // Sample employees
  const insertEmployee = db.prepare(`
    INSERT INTO employees (employee_id, name, position, department, email, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const sampleEmployees = [
    ['EMP-001', 'Carlos Rodríguez', 'Supervisor de Zona', 'Operaciones', 'carlos.rodriguez@seguridadnacional.com', '555-0101'],
    ['EMP-002', 'María González', 'Agente de Seguridad', 'Operaciones', 'maria.gonzalez@seguridadnacional.com', '555-0102'],
    ['EMP-003', 'Juan Martínez', 'Jefe de Bodega', 'Logística', 'juan.martinez@seguridadnacional.com', '555-0103'],
    ['EMP-004', 'Ana López', 'Coordinadora', 'Administración', 'ana.lopez@seguridadnacional.com', '555-0104'],
    ['EMP-005', 'Roberto Sánchez', 'Agente de Seguridad', 'Operaciones', 'roberto.sanchez@seguridadnacional.com', '555-0105'],
    ['EMP-006', 'Laura Torres', 'Supervisora Nocturna', 'Operaciones', 'laura.torres@seguridadnacional.com', '555-0106'],
  ];

  const insertManyEmployees = db.transaction((items) => {
    for (const item of items) {
      insertEmployee.run(...item);
    }
  });
  insertManyEmployees(sampleEmployees);
}

export default db;
