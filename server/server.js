import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import XLSX from 'xlsx';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Helper: emit real-time update ───
function emitUpdate(event, data) {
    io.emit(event, data);
}

// ─── PRODUCTS API ───

// Get all products
app.get('/api/products', (req, res) => {
    try {
        const { category, search, alert } = req.query;
        let query = 'SELECT * FROM products';
        const conditions = [];
        const params = [];

        if (category && category !== 'all') {
            conditions.push('category = ?');
            params.push(category);
        }
        if (search) {
            conditions.push('(name LIKE ? OR code LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        if (alert === 'critical') {
            conditions.push('quantity < 10');
        } else if (alert === 'low') {
            conditions.push('quantity >= 10 AND quantity < 20');
        } else if (alert === 'optimal') {
            conditions.push('quantity >= 20');
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY updated_at DESC';

        const products = db.prepare(query).all(...params);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get product by code (for scanner)
app.get('/api/products/code/:code', (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE code = ?').get(req.params.code);
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single product
app.get('/api/products/:id', (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product
app.post('/api/products', (req, res) => {
    try {
        const { code, name, quantity, category } = req.body;
        if (!code || !name) return res.status(400).json({ error: 'Código y nombre son requeridos' });

        const result = db.prepare(`
      INSERT INTO products (code, name, quantity, category, barcode_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, name, quantity || 0, category || 'General', code);

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        emitUpdate('product:created', product);
        res.status(201).json(product);
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'El código ya existe' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Update product
app.put('/api/products/:id', (req, res) => {
    try {
        const { name, quantity, category } = req.body;
        db.prepare(`
      UPDATE products SET name = ?, quantity = ?, category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, quantity, category, req.params.id);

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        emitUpdate('product:updated', product);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Restock product (add inventory)
app.post('/api/products/:id/restock', (req, res) => {
    try {
        const { quantity, supplier, invoice, notes } = req.body;
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

        db.prepare(`
      UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(qty, req.params.id);

        // Log the restock in a restock_log if table exists, or just update
        const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        emitUpdate('product:updated', updatedProduct);
        emitUpdate('restock:created', {
            product_id: updatedProduct.id,
            product_name: updatedProduct.name,
            product_code: updatedProduct.code,
            quantity_added: qty,
            new_quantity: updatedProduct.quantity,
            supplier: supplier || '',
            invoice: invoice || '',
            notes: notes || '',
            date: new Date().toISOString()
        });

        res.json({
            ...updatedProduct,
            quantity_added: qty,
            message: `Se agregaron ${qty} unidades a ${updatedProduct.name}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Import products from Excel
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post('/api/products/import-excel', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Helper: normalize a string by stripping accents, lowercasing, removing extra spaces
        const normalize = (str) => String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

        // Helper: safely parse a number from any value
        const safeParseInt = (val) => {
            if (val === '' || val === null || val === undefined) return NaN;
            const n = Number(val);
            return isNaN(n) ? NaN : Math.floor(n);
        };

        // --- SMART COLUMN DETECTION ---
        // Keywords that identify each field type (checked via "contains")
        const codeKeywords = ['codigo', 'code', 'cod', 'sku', 'referencia', 'ref', 'id producto', 'item'];
        const nameKeywords = ['nombre', 'name', 'producto', 'descripcion', 'description', 'articulo', 'material'];
        const qtyKeywords = ['cantidad', 'quantity', 'qty', 'stock', 'unidades', 'existencia', 'cant', 'piezas'];
        const catKeywords = ['categoria', 'category', 'tipo', 'type', 'grupo', 'clase', 'linea', 'familia'];

        // Get headers from the sheet
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) return res.status(400).json({ error: 'El archivo está vacío' });

        const headers = Object.keys(rows[0]);
        const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalize(h) }));

        // Try to match a header to keywords
        const findColumn = (keywords) => {
            for (const kw of keywords) {
                for (const h of normalizedHeaders) {
                    // Exact match after normalization
                    if (h.normalized === kw) return h.original;
                }
            }
            // Partial match (header contains keyword or keyword contains header)
            for (const kw of keywords) {
                for (const h of normalizedHeaders) {
                    if (h.normalized.includes(kw) || kw.includes(h.normalized)) return h.original;
                }
            }
            return null;
        };

        let codeCol = findColumn(codeKeywords);
        let nameCol = findColumn(nameKeywords);
        let qtyCol = findColumn(qtyKeywords);
        let catCol = findColumn(catKeywords);

        // Fallback: if we couldn't detect code AND name columns, try positional mapping
        let usedPositional = false;
        if (!codeCol && !nameCol) {
            // Maybe the headers themselves are data (no header row) — try with raw cells
            // Or the columns just have unusual names — map by position
            if (headers.length >= 2) {
                codeCol = headers[0];
                nameCol = headers[1];
                qtyCol = headers.length >= 3 ? headers[2] : null;
                catCol = headers.length >= 4 ? headers[3] : null;
                usedPositional = true;

                // Check if the first "row" is actually a header that we didn't recognize
                // If first row values look like headers (all strings, no numbers), re-read with header:1
                const firstVals = headers.map(h => rows[0][h]);
                const allStrings = firstVals.every(v => typeof v === 'string' && v.length > 0 && isNaN(Number(v)));
                if (allStrings && rows.length > 1) {
                    // The first row IS a header row, but XLSX didn't match our patterns
                    // Use the raw first-row values as the column mapping
                    const rawHeaders = firstVals.map(v => normalize(String(v)));

                    // Re-detect with raw header values
                    const findInRaw = (keywords) => {
                        for (const kw of keywords) {
                            for (let idx = 0; idx < rawHeaders.length; idx++) {
                                if (rawHeaders[idx] === kw || rawHeaders[idx].includes(kw) || kw.includes(rawHeaders[idx])) {
                                    return { col: headers[idx], idx };
                                }
                            }
                        }
                        return null;
                    };

                    const rawCode = findInRaw(codeKeywords);
                    const rawName = findInRaw(nameKeywords);
                    if (rawCode && rawName) {
                        codeCol = rawCode.col;
                        nameCol = rawName.col;
                        const rawQty = findInRaw(qtyKeywords);
                        const rawCat = findInRaw(catKeywords);
                        qtyCol = rawQty ? rawQty.col : null;
                        catCol = rawCat ? rawCat.col : null;
                        // Skip first row since it's a header
                        rows.shift();
                        usedPositional = false;
                    }
                }
            }
        }

        const columnMapping = {
            code: codeCol || '(no detectada)',
            name: nameCol || '(no detectada)',
            quantity: qtyCol || '(no detectada)',
            category: catCol || '(no detectada)',
            positional: usedPositional,
            availableHeaders: headers
        };

        console.log('📊 Excel Import — Column mapping:', JSON.stringify(columnMapping, null, 2));

        if (!codeCol || !nameCol) {
            return res.status(400).json({
                error: `No se pudieron detectar las columnas de código y nombre. Columnas encontradas: ${headers.join(', ')}. Use columnas llamadas "codigo" y "nombre" o "code" y "name".`,
                columnMapping
            });
        }

        const results = { created: 0, updated: 0, errors: [], products: [] };

        const insertStmt = db.prepare(`
            INSERT INTO products (code, name, quantity, category, barcode_data)
            VALUES (?, ?, ?, ?, ?)
        `);
        const updateStmt = db.prepare(`
            UPDATE products SET name = ?, quantity = quantity + ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?
        `);
        const findStmt = db.prepare('SELECT * FROM products WHERE code = ?');

        const importAll = db.transaction(() => {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                try {
                    const code = String(row[codeCol] ?? '').trim();
                    const name = String(row[nameCol] ?? '').trim();
                    const rawQty = qtyCol ? row[qtyCol] : 0;
                    const qty = safeParseInt(rawQty);
                    const category = catCol ? String(row[catCol] ?? 'General').trim() || 'General' : 'General';

                    if (!code || !name) {
                        results.errors.push(`Fila ${i + 2}: código o nombre vacío (código="${code}", nombre="${name}")`);
                        continue;
                    }
                    if (isNaN(qty) || qty < 0) {
                        results.errors.push(`Fila ${i + 2}: cantidad inválida (${rawQty}) para ${code}`);
                        continue;
                    }

                    const existing = findStmt.get(code);
                    if (existing) {
                        updateStmt.run(name, qty, category, code);
                        results.updated++;
                    } else {
                        insertStmt.run(code, name, qty, category, code);
                        results.created++;
                    }
                    results.products.push({ code, name, quantity: qty, category });
                } catch (rowError) {
                    results.errors.push(`Fila ${i + 2}: ${rowError.message}`);
                }
            }
        });

        importAll();

        emitUpdate('product:updated', {});
        res.json({
            message: `Importación completada: ${results.created} creados, ${results.updated} actualizados`,
            ...results,
            total: rows.length,
            columnMapping
        });
    } catch (error) {
        res.status(500).json({ error: 'Error procesando archivo: ' + error.message });
    }
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
        emitUpdate('product:deleted', { id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get categories
app.get('/api/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
        res.json(categories.map(c => c.category));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── EMPLOYEES API ───

app.get('/api/employees', (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM employees';
        const params = [];
        if (search) {
            query += ' WHERE name LIKE ? OR employee_id LIKE ? OR department LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY name ASC';
        const employees = db.prepare(query).all(...params);
        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/employees/:id', (req, res) => {
    try {
        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });

        // Get delivery history
        const deliveries = db.prepare(`
      SELECT d.*, p.name as product_name, p.code as product_code
      FROM deliveries d
      JOIN products p ON d.product_id = p.id
      WHERE d.employee_id = ?
      ORDER BY d.created_at DESC
    `).all(req.params.id);

        res.json({ ...employee, deliveries });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/employees', (req, res) => {
    try {
        const { employee_id, name, position, department, email, phone } = req.body;
        if (!employee_id || !name) return res.status(400).json({ error: 'ID y nombre son requeridos' });

        const result = db.prepare(`
      INSERT INTO employees (employee_id, name, position, department, email, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(employee_id, name, position || '', department || '', email || '', phone || '');

        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
        emitUpdate('employee:created', employee);
        res.status(201).json(employee);
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'El ID de empleado ya existe' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/employees/:id', (req, res) => {
    try {
        const { name, position, department, email, phone } = req.body;
        db.prepare(`
      UPDATE employees SET name = ?, position = ?, department = ?, email = ?, phone = ?
      WHERE id = ?
    `).run(name, position, department, email, phone, req.params.id);

        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
        emitUpdate('employee:updated', employee);
        res.json(employee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/employees/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
        emitUpdate('employee:deleted', { id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── DELIVERIES API ───

app.get('/api/deliveries', (req, res) => {
    try {
        const { employee_id, product_id, from, to } = req.query;
        let query = `
      SELECT d.*, p.name as product_name, p.code as product_code, p.category,
             e.name as employee_name, e.employee_id as employee_code, e.department
      FROM deliveries d
      JOIN products p ON d.product_id = p.id
      JOIN employees e ON d.employee_id = e.id
    `;
        const conditions = [];
        const params = [];

        if (employee_id) { conditions.push('d.employee_id = ?'); params.push(employee_id); }
        if (product_id) { conditions.push('d.product_id = ?'); params.push(product_id); }
        if (from) { conditions.push('d.created_at >= ?'); params.push(from); }
        if (to) { conditions.push('d.created_at <= ?'); params.push(to); }

        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY d.created_at DESC';

        const deliveries = db.prepare(query).all(...params);
        res.json(deliveries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create delivery (main flow)
app.post('/api/deliveries', (req, res) => {
    try {
        const { product_id, employee_id, quantity, signature_data, delivered_by, notes } = req.body;
        if (!product_id || !employee_id) {
            return res.status(400).json({ error: 'Producto y empleado son requeridos' });
        }

        const qty = quantity || 1;

        // Check stock
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
        if (product.quantity < qty) {
            return res.status(400).json({ error: `Stock insuficiente. Disponible: ${product.quantity}` });
        }

        // Transaction: create delivery + update stock + create assignment
        const createDelivery = db.transaction(() => {
            // Insert delivery
            const result = db.prepare(`
        INSERT INTO deliveries (product_id, employee_id, quantity, signature_data, delivered_by, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(product_id, employee_id, qty, signature_data || '', delivered_by || 'Sistema', notes || '');

            // Decrement stock
            db.prepare(`
        UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(qty, product_id);

            // Create assignment
            db.prepare(`
        INSERT INTO assignments (delivery_id, product_id, employee_id, quantity, status, change_reason, observations, last_change_date)
        VALUES (?, ?, ?, ?, 'activo', 'Asignación inicial', ?, CURRENT_TIMESTAMP)
      `).run(result.lastInsertRowid, product_id, employee_id, qty, notes || '');

            return result.lastInsertRowid;
        });

        const deliveryId = createDelivery();

        // Get full delivery data
        const delivery = db.prepare(`
      SELECT d.*, p.name as product_name, p.code as product_code, p.category,
             e.name as employee_name, e.employee_id as employee_code, e.department
      FROM deliveries d
      JOIN products p ON d.product_id = p.id
      JOIN employees e ON d.employee_id = e.id
      WHERE d.id = ?
    `).get(deliveryId);

        const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);

        emitUpdate('delivery:created', delivery);
        emitUpdate('product:updated', updatedProduct);
        emitUpdate('assignment:created', { employee_id });

        res.status(201).json(delivery);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create bulk delivery (multiple products for one employee)
app.post('/api/deliveries/bulk', (req, res) => {
    try {
        const { employee_id, products, signature_data, delivered_by, notes } = req.body;
        if (!employee_id || !products || !products.length) {
            return res.status(400).json({ error: 'Empleado y productos son requeridos' });
        }

        // Validate all products stock first
        const productInfos = [];
        for (const p of products) {
            const qty = p.quantity || 1;
            const product = db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);
            if (!product) return res.status(404).json({ error: `Producto ID ${p.id} no encontrado` });
            if (product.quantity < qty) {
                return res.status(400).json({ error: `Stock insuficiente para ${product.name}. Disponible: ${product.quantity}` });
            }
            productInfos.push({ product, qty });
        }

        const deliveryIds = [];
        let actaNumber = 0;

        // Transaction for all operations
        const createBulkDeliveries = db.transaction(() => {
            // Increment acta counter atomically
            db.prepare('UPDATE counters SET value = value + 1 WHERE key = ?').run('acta_entrega');
            const counter = db.prepare('SELECT value FROM counters WHERE key = ?').get('acta_entrega');
            actaNumber = counter.value;

            for (const { product, qty } of productInfos) {
                // Insert delivery
                const result = db.prepare(`
                    INSERT INTO deliveries (product_id, employee_id, quantity, signature_data, delivered_by, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(product.id, employee_id, qty, signature_data || '', delivered_by || 'Sistema', notes || '');

                const deliveryId = result.lastInsertRowid;
                deliveryIds.push(deliveryId);

                // Decrement stock
                db.prepare(`
                    UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(qty, product.id);

                // Create assignment
                db.prepare(`
                    INSERT INTO assignments (delivery_id, product_id, employee_id, quantity, status, change_reason, observations, last_change_date)
                    VALUES (?, ?, ?, ?, 'activo', 'Asignación inicial', ?, CURRENT_TIMESTAMP)
                `).run(deliveryId, product.id, employee_id, qty, notes || '');
            }
        });

        createBulkDeliveries();

        // Get full data for response
        const placeholders = deliveryIds.map(() => '?').join(',');
        const deliveries = db.prepare(`
            SELECT d.*, p.name as product_name, p.code as product_code, p.category,
                   e.name as employee_name, e.employee_id as employee_code, e.department
            FROM deliveries d
            JOIN products p ON d.product_id = p.id
            JOIN employees e ON d.employee_id = e.id
            WHERE d.id IN (${placeholders})
        `).all(...deliveryIds);

        // Emit updates
        for (const delivery of deliveries) {
            emitUpdate('delivery:created', delivery);
        }
        emitUpdate('product:updated', {});
        emitUpdate('assignment:created', { employee_id });

        // Return deliveries with the acta number
        res.status(201).json({ deliveries, acta_number: actaNumber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ─── ASSIGNMENTS API ───

// Get all assignments (with filters)
app.get('/api/assignments', (req, res) => {
    try {
        const { employee_id, status, product_id } = req.query;
        let query = `
      SELECT a.*, p.name as product_name, p.code as product_code, p.category,
             e.name as employee_name, e.employee_id as employee_code, e.department
      FROM assignments a
      JOIN products p ON a.product_id = p.id
      JOIN employees e ON a.employee_id = e.id
    `;
        const conditions = [];
        const params = [];

        if (employee_id) { conditions.push('a.employee_id = ?'); params.push(employee_id); }
        if (status) { conditions.push('a.status = ?'); params.push(status); }
        if (product_id) { conditions.push('a.product_id = ?'); params.push(product_id); }

        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY a.assigned_at DESC';

        const assignments = db.prepare(query).all(...params);
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get active assignments for a specific employee
app.get('/api/assignments/employee/:id', (req, res) => {
    try {
        const { status } = req.query;
        let query = `
      SELECT a.*, p.name as product_name, p.code as product_code, p.category,
             e.name as employee_name, e.employee_id as employee_code, e.department
      FROM assignments a
      JOIN products p ON a.product_id = p.id
      JOIN employees e ON a.employee_id = e.id
      WHERE a.employee_id = ?
    `;
        const params = [req.params.id];

        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }

        query += ' ORDER BY a.status ASC, a.assigned_at DESC';
        const assignments = db.prepare(query).all(...params);
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Return an assignment (restore stock)
app.post('/api/assignments/:id/return', (req, res) => {
    try {
        const { change_reason, observations } = req.body;
        const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
        if (!assignment) return res.status(404).json({ error: 'Asignación no encontrada' });
        if (assignment.status !== 'activo') {
            return res.status(400).json({ error: 'Solo se pueden devolver asignaciones activas' });
        }

        const returnItem = db.transaction(() => {
            // Mark assignment as returned
            db.prepare(`
        UPDATE assignments SET status = 'devuelto', change_reason = ?, observations = ?,
        last_change_date = CURRENT_TIMESTAMP, returned_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(change_reason || 'Devolución', observations || '', req.params.id);

            // Restore stock
            db.prepare(`
        UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(assignment.quantity, assignment.product_id);
        });
        returnItem();

        const updated = db.prepare(`
      SELECT a.*, p.name as product_name, p.code as product_code, p.category,
             e.name as employee_name, e.employee_id as employee_code
      FROM assignments a
      JOIN products p ON a.product_id = p.id
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ?
    `).get(req.params.id);

        const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(assignment.product_id);

        emitUpdate('assignment:updated', { employee_id: assignment.employee_id });
        emitUpdate('product:updated', updatedProduct);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Report damage and optionally create replacement
app.post('/api/assignments/:id/damage', (req, res) => {
    try {
        const { change_reason, observations, signature_data, auto_replace } = req.body;
        const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
        if (!assignment) return res.status(404).json({ error: 'Asignación no encontrada' });
        if (assignment.status !== 'activo') {
            return res.status(400).json({ error: 'Solo se pueden reportar daños en asignaciones activas' });
        }

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(assignment.product_id);
        const canReplace = auto_replace !== false && product && product.quantity >= assignment.quantity;

        const processDamage = db.transaction(() => {
            // Mark current as damaged
            db.prepare(`
        UPDATE assignments SET status = 'dañado', change_reason = ?, observations = ?,
        last_change_date = CURRENT_TIMESTAMP, returned_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(change_reason || 'Daño reportado', observations || '', req.params.id);

            let newAssignmentId = null;

            if (canReplace) {
                // Create new delivery for replacement
                const deliveryResult = db.prepare(`
          INSERT INTO deliveries (product_id, employee_id, quantity, signature_data, delivered_by, notes)
          VALUES (?, ?, ?, ?, 'Bodeguero', ?)
        `).run(assignment.product_id, assignment.employee_id, assignment.quantity,
                    signature_data || '', `Reemplazo por daño: ${change_reason || 'Daño reportado'}`);

                // Decrement stock for replacement
                db.prepare(`
          UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(assignment.quantity, assignment.product_id);

                // Create replacement assignment
                const assignResult = db.prepare(`
          INSERT INTO assignments (delivery_id, product_id, employee_id, quantity, status, change_reason, observations, last_change_date, replaced_assignment_id)
          VALUES (?, ?, ?, ?, 'activo', ?, ?, CURRENT_TIMESTAMP, ?)
        `).run(deliveryResult.lastInsertRowid, assignment.product_id, assignment.employee_id,
                    assignment.quantity, `Reemplazo por daño`, observations || '', req.params.id);

                newAssignmentId = assignResult.lastInsertRowid;

                // Link old assignment to replacement
                db.prepare('UPDATE assignments SET replacement_id = ? WHERE id = ?')
                    .run(newAssignmentId, req.params.id);
            }

            return newAssignmentId;
        });

        const newAssignmentId = processDamage();

        // Get updated data
        const damaged = db.prepare(`
      SELECT a.*, p.name as product_name, p.code as product_code, p.category,
             e.name as employee_name, e.employee_id as employee_code, e.department
      FROM assignments a
      JOIN products p ON a.product_id = p.id
      JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ?
    `).get(req.params.id);

        let replacement = null;
        if (newAssignmentId) {
            replacement = db.prepare(`
        SELECT a.*, p.name as product_name, p.code as product_code, p.category,
               e.name as employee_name, e.employee_id as employee_code, e.department
        FROM assignments a
        JOIN products p ON a.product_id = p.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.id = ?
      `).get(newAssignmentId);
        }

        const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(assignment.product_id);

        emitUpdate('assignment:updated', { employee_id: assignment.employee_id });
        emitUpdate('product:updated', updatedProduct);
        if (replacement) emitUpdate('delivery:created', {});

        res.json({ damaged, replacement, stock_available: canReplace });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── DASHBOARD STATS ───

app.get('/api/stats', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const totalEmployees = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
        const totalDeliveries = db.prepare('SELECT COUNT(*) as count FROM deliveries').get().count;
        const criticalStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE quantity < 10').get().count;
        const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE quantity >= 10 AND quantity < 20').get().count;
        const optimalStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE quantity >= 20').get().count;
        const totalItems = db.prepare('SELECT SUM(quantity) as total FROM products').get().total || 0;

        const recentDeliveries = db.prepare(`
      SELECT d.*, p.name as product_name, e.name as employee_name
      FROM deliveries d
      JOIN products p ON d.product_id = p.id
      JOIN employees e ON d.employee_id = e.id
      ORDER BY d.created_at DESC LIMIT 5
    `).all();

        const lowStockProducts = db.prepare(`
      SELECT * FROM products WHERE quantity < 20 ORDER BY quantity ASC
    `).all();

        res.json({
            totalProducts,
            totalEmployees,
            totalDeliveries,
            criticalStock,
            lowStock,
            optimalStock,
            totalItems,
            recentDeliveries,
            lowStockProducts
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Socket.IO ───
io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    socket.on('disconnect', () => {
        console.log('🔌 Cliente desconectado:', socket.id);
    });
});

// ─── Serve static files (production) ───
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA catch-all: serve index.html for any non-API route
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
        res.sendFile(path.join(distPath, 'index.html'));
    }
});

// ─── Start Server ───
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   🛡️  Seguridad Nacional — PRODUCCIÓN           ║
  ║   📡 Puerto: ${PORT}                               ║
  ║   🌐 URL: http://localhost:${PORT}                  ║
  ║   🗄️  Base de datos: SQLite                      ║
  ║   🔌 WebSocket: Habilitado                       ║
  ║   📁 Frontend: ${distPath}  ║
  ╚══════════════════════════════════════════════════╝
  `);
});
