import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import StockBadge from '../shared/StockBadge';
import BarcodeDisplay from '../shared/BarcodeDisplay';

export default function Inventory() {
    const { products, fetchProducts, createProduct, updateProduct, deleteProduct, restockProduct, addToast } = useApp();
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [restockingProduct, setRestockingProduct] = useState(null);
    const [showBarcode, setShowBarcode] = useState(null);
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({ code: '', name: '', quantity: 0, category: 'General' });
    const [restockForm, setRestockForm] = useState({ quantity: 1, supplier: '', invoice: '', notes: '' });

    useEffect(() => {
        fetchProducts({ search, category: categoryFilter });
        fetch('/api/categories').then(r => r.json()).then(setCategories).catch(() => { });
    }, [search, categoryFilter]);

    const openCreate = () => {
        setEditingProduct(null);
        setForm({ code: '', name: '', quantity: 0, category: 'General' });
        setShowModal(true);
    };

    const openEdit = (product) => {
        setEditingProduct(product);
        setForm({ code: product.code, name: product.name, quantity: product.quantity, category: product.category });
        setShowModal(true);
    };

    const openRestock = (product) => {
        setRestockingProduct(product);
        setRestockForm({ quantity: 1, supplier: '', invoice: '', notes: '' });
        setShowRestockModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingProduct) {
                await updateProduct(editingProduct.id, form);
            } else {
                await createProduct(form);
            }
            setShowModal(false);
            fetchProducts({ search, category: categoryFilter });
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleRestock = async (e) => {
        e.preventDefault();
        try {
            await restockProduct(restockingProduct.id, restockForm);
            setShowRestockModal(false);
            fetchProducts({ search, category: categoryFilter });
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este producto?')) return;
        try {
            await deleteProduct(id);
            fetchProducts({ search, category: categoryFilter });
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/products/import-excel', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setImportResult(data);
            fetchProducts({ search, category: categoryFilter });
            addToast(data.message, 'success');

            // Auto-generate barcode PDF
            if (data.products && data.products.length > 0) {
                generateBarcodePdf(data.products);
            }
        } catch (err) {
            addToast('Error importando: ' + err.message, 'error');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const generateBarcodePdf = async (productsList) => {
        try {
            const { default: jsPDF } = await import('jspdf');
            const JsBarcode = (await import('jsbarcode')).default;

            const doc = new jsPDF('p', 'mm', 'letter');
            const pageW = doc.internal.pageSize.getWidth();
            const cols = 3;
            const barcodeW = 55;
            const barcodeH = 25;
            const cellW = pageW / cols;
            const marginTop = 20;
            const rowH = 45;

            // Title
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Seguridad Nacional — Códigos de Barras', pageW / 2, 12, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')} — ${productsList.length} productos`, pageW / 2, 17, { align: 'center' });

            let row = 0;
            let col = 0;

            for (let i = 0; i < productsList.length; i++) {
                const p = productsList[i];
                const x = col * cellW + (cellW - barcodeW) / 2;
                const y = marginTop + row * rowH + 5;

                // Generate barcode to canvas
                const canvas = document.createElement('canvas');
                try {
                    JsBarcode(canvas, p.code, {
                        format: 'CODE128',
                        width: 2,
                        height: 50,
                        displayValue: true,
                        fontSize: 12,
                        margin: 2
                    });
                    const imgData = canvas.toDataURL('image/png');
                    doc.addImage(imgData, 'PNG', x, y, barcodeW, barcodeH);
                } catch {
                    doc.setFontSize(8);
                    doc.text(p.code, x + barcodeW / 2, y + barcodeH / 2, { align: 'center' });
                }

                // Product name below barcode
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                const nameText = p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name;
                doc.text(nameText, x + barcodeW / 2, y + barcodeH + 4, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.text(`Cant: ${p.quantity} | ${p.category}`, x + barcodeW / 2, y + barcodeH + 8, { align: 'center' });

                col++;
                if (col >= cols) {
                    col = 0;
                    row++;
                }
                // New page if needed
                if (y + rowH + 10 > doc.internal.pageSize.getHeight() && i < productsList.length - 1 && col === 0) {
                    doc.addPage();
                    row = 0;
                    doc.setFontSize(8);
                    doc.text(`Seguridad Nacional — Códigos de Barras (pág. ${doc.getNumberOfPages()})`, pageW / 2, 8, { align: 'center' });
                }
            }

            doc.save(`codigos_barras_${new Date().toISOString().slice(0, 10)}.pdf`);
            addToast('📄 PDF de códigos de barras descargado', 'success');
        } catch (err) {
            addToast('Error generando PDF: ' + err.message, 'error');
        }
    };

    const handleExportExcel = async () => {
        try {
            const XLSX = await import('xlsx');
            const exportData = products.map(p => ({
                'Código': p.code,
                'Nombre del Producto': p.name,
                'Categoría/Tipo': p.category,
                'Cantidad en Stock': p.quantity
            }));
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
            XLSX.writeFile(workbook, `Inventario_Seguridad_Nacional_${new Date().toISOString().split('T')[0]}.xlsx`);
            addToast('✅ Excel exportado correctamente', 'success');
        } catch (err) {
            addToast('❌ Error exportando Excel: ' + err.message, 'error');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h2>📦 Inventario</h2>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={handleExportExcel}>
                        📊 Exportar a Excel
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportExcel}
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn btn-success"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                    >
                        {importing ? '⏳ Importando...' : '📄 Importar Excel'}
                    </button>
                    <button className="btn btn-primary" onClick={openCreate}>➕ Nuevo Producto</button>
                </div>
            </div>

            <div className="content-area">
                {/* Toolbar */}
                <div className="toolbar">
                    <div className="search-bar" style={{ flex: 1 }}>
                        <span className="search-icon">🔍</span>
                        <input
                            className="form-control"
                            style={{ paddingLeft: 40 }}
                            placeholder="Buscar por nombre o código..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="form-control"
                        style={{ width: 200 }}
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                    >
                        <option value="all">Todas las categorías</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th>Categoría</th>
                                <th>Stock</th>
                                <th>Estado</th>
                                <th>Código de Barras</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="empty-state">
                                            <div className="empty-icon">📦</div>
                                            <p>No hay productos registrados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                products.map(product => (
                                    <tr key={product.id}>
                                        <td>
                                            <code style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{product.code}</code>
                                        </td>
                                        <td><strong>{product.name}</strong></td>
                                        <td className="text-muted">{product.category}</td>
                                        <td><strong>{product.quantity}</strong></td>
                                        <td><StockBadge quantity={product.quantity} /></td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setShowBarcode(showBarcode === product.id ? null : product.id)}
                                            >
                                                {showBarcode === product.id ? '🔼 Ocultar' : '📊 Ver'}
                                            </button>
                                            {showBarcode === product.id && (
                                                <div style={{ marginTop: 8 }}>
                                                    <BarcodeDisplay value={product.code} height={40} fontSize={12} />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex gap-sm">
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => openRestock(product)}
                                                    title="Agregar stock"
                                                >
                                                    📥 Abastecer
                                                </button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(product)}>✏️</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(product.id)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Crear/Editar */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingProduct ? '✏️ Editar Producto' : '➕ Nuevo Producto'}</h3>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Código</label>
                                    <input
                                        className="form-control"
                                        value={form.code}
                                        onChange={e => setForm({ ...form, code: e.target.value })}
                                        placeholder="Ej: SN-UNI-001"
                                        required
                                        disabled={!!editingProduct}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nombre del Producto</label>
                                    <input
                                        className="form-control"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="Ej: Uniforme Táctico"
                                        required
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Cantidad</label>
                                        <input
                                            className="form-control"
                                            type="number"
                                            min="0"
                                            value={form.quantity}
                                            onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Categoría</label>
                                        <select
                                            className="form-control"
                                            value={form.category}
                                            onChange={e => setForm({ ...form, category: e.target.value })}
                                        >
                                            <option value="General">General</option>
                                            <option value="Uniformes">Uniformes</option>
                                            <option value="Comunicaciones">Comunicaciones</option>
                                            <option value="Defensa">Defensa</option>
                                            <option value="Tecnología">Tecnología</option>
                                            <option value="Protección">Protección</option>
                                        </select>
                                    </div>
                                </div>
                                {form.code && (
                                    <div className="form-group">
                                        <label>Vista previa del Código de Barras</label>
                                        <BarcodeDisplay value={form.code} />
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingProduct ? '💾 Guardar Cambios' : '➕ Crear Producto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Abastecer Inventario */}
            {showRestockModal && restockingProduct && (
                <div className="modal-overlay" onClick={() => setShowRestockModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📥 Abastecer Inventario</h3>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowRestockModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleRestock}>
                            <div className="modal-body">
                                {/* Product info card */}
                                <div style={{
                                    background: 'var(--color-accent-alpha, rgba(232,185,74,0.06))',
                                    border: '1px solid var(--color-accent-dim, rgba(232,185,74,0.15))',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-md)',
                                    marginBottom: 'var(--space-lg)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{restockingProduct.name}</div>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                            {restockingProduct.code} • {restockingProduct.category}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                                            {restockingProduct.quantity}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Stock actual</div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>📦 Cantidad a agregar *</label>
                                    <input
                                        className="form-control"
                                        type="number"
                                        min="1"
                                        value={restockForm.quantity}
                                        onChange={e => setRestockForm({ ...restockForm, quantity: parseInt(e.target.value) || 1 })}
                                        style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }}
                                        required
                                        autoFocus
                                    />
                                    <div style={{
                                        textAlign: 'center',
                                        marginTop: 8,
                                        color: 'var(--color-success)',
                                        fontWeight: 600,
                                        fontSize: '0.85rem'
                                    }}>
                                        Nuevo stock: {restockingProduct.quantity + (parseInt(restockForm.quantity) || 0)} unidades
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>🏢 Proveedor</label>
                                    <input
                                        className="form-control"
                                        value={restockForm.supplier}
                                        onChange={e => setRestockForm({ ...restockForm, supplier: e.target.value })}
                                        placeholder="Nombre del proveedor"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>🧾 N° Factura / Remisión</label>
                                    <input
                                        className="form-control"
                                        value={restockForm.invoice}
                                        onChange={e => setRestockForm({ ...restockForm, invoice: e.target.value })}
                                        placeholder="Ej: FAC-2026-0045"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>📝 Observaciones</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        value={restockForm.notes}
                                        onChange={e => setRestockForm({ ...restockForm, notes: e.target.value })}
                                        placeholder="Notas adicionales sobre esta entrada de inventario..."
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowRestockModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-success" style={{ fontWeight: 700 }}>
                                    📥 Agregar {restockForm.quantity} unidades
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Resultado Importación */}
            {importResult && (
                <div className="modal-overlay" onClick={() => setImportResult(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📄 Resultado de Importación</h3>
                            <button className="btn btn-icon btn-secondary" onClick={() => setImportResult(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                                <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--space-md)' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>{importResult.created}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Creados</div>
                                </div>
                                <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--space-md)' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>{importResult.updated}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Actualizados</div>
                                </div>
                                <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--space-md)' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: importResult.errors?.length ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                                        {importResult.errors?.length || 0}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Errores</div>
                                </div>
                            </div>
                            {importResult.errors?.length > 0 && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-sm)',
                                    maxHeight: 150,
                                    overflow: 'auto',
                                    fontSize: '0.8rem'
                                }}>
                                    {importResult.errors.map((err, i) => <div key={i} style={{ padding: '4px 0' }}>⚠️ {err}</div>)}
                                </div>
                            )}
                            <div style={{
                                marginTop: 'var(--space-md)',
                                padding: 'var(--space-sm)',
                                background: 'rgba(232,185,74,0.06)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8rem',
                                color: 'var(--color-text-muted)'
                            }}>
                                💡 Formato esperado: columnas <strong>codigo</strong>, <strong>nombre</strong>, <strong>cantidad</strong> y opcionalmente <strong>categoria</strong>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => setImportResult(null)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
