import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import StockBadge from '../shared/StockBadge';

export default function MobileInventory() {
    const { products, fetchProducts, restockProduct, addToast } = useApp();
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [categories, setCategories] = useState([]);
    const [showRestock, setShowRestock] = useState(null);
    const [restockForm, setRestockForm] = useState({ quantity: 1, supplier: '', invoice: '', notes: '' });

    useEffect(() => {
        fetchProducts({ search, category: categoryFilter });
        fetch('/api/categories').then(r => r.json()).then(setCategories).catch(() => { });
    }, [search, categoryFilter]);

    const openRestock = (product) => {
        setShowRestock(product);
        setRestockForm({ quantity: 1, supplier: '', invoice: '', notes: '' });
    };

    const handleRestock = async (e) => {
        e.preventDefault();
        try {
            await restockProduct(showRestock.id, restockForm);
            setShowRestock(null);
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
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div>
            <div className="mobile-header">
                <h1>📦 Inventario</h1>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportExcel}
                    style={{ display: 'none' }}
                />
                <button
                    className="btn btn-sm btn-success"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    style={{ fontSize: '0.75rem' }}
                >
                    {importing ? '⏳...' : '📄 Excel'}
                </button>
            </div>
            <div className="mobile-content">
                <input
                    className="form-control"
                    placeholder="🔍 Buscar producto..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ marginBottom: 'var(--space-sm)' }}
                />
                <select
                    className="form-control"
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    style={{ marginBottom: 'var(--space-md)' }}
                >
                    <option value="all">Todas las categorías</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {products.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📦</div>
                        <p>No hay productos</p>
                    </div>
                ) : (
                    products.map(p => (
                        <div key={p.id} className="card" style={{ marginBottom: 'var(--space-sm)', padding: 'var(--space-md)' }}>
                            <div className="flex justify-between items-center">
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{p.name}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                        {p.code} • {p.category}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <StockBadge quantity={p.quantity} />
                                    <button
                                        className="btn btn-sm btn-success"
                                        onClick={() => openRestock(p)}
                                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                    >
                                        📥
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Abastecer */}
            {showRestock && (
                <div className="modal-overlay" onClick={() => setShowRestock(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ margin: 16, maxHeight: '90vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h3>📥 Abastecer</h3>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowRestock(null)}>✕</button>
                        </div>
                        <form onSubmit={handleRestock}>
                            <div className="modal-body">
                                {/* Product info */}
                                <div style={{
                                    background: 'rgba(232,185,74,0.06)',
                                    border: '1px solid rgba(232,185,74,0.15)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-md)',
                                    marginBottom: 'var(--space-md)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{showRestock.name}</div>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                            {showRestock.code} • {showRestock.category}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                                            {showRestock.quantity}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Actual</div>
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
                                        marginTop: 6,
                                        color: 'var(--color-success)',
                                        fontWeight: 600,
                                        fontSize: '0.8rem'
                                    }}>
                                        Nuevo stock: {showRestock.quantity + (parseInt(restockForm.quantity) || 0)}
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
                                    <label>🧾 N° Factura</label>
                                    <input
                                        className="form-control"
                                        value={restockForm.invoice}
                                        onChange={e => setRestockForm({ ...restockForm, invoice: e.target.value })}
                                        placeholder="FAC-2026-0045"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>📝 Observaciones</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        value={restockForm.notes}
                                        onChange={e => setRestockForm({ ...restockForm, notes: e.target.value })}
                                        placeholder="Notas adicionales..."
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowRestock(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-success" style={{ fontWeight: 700 }}>
                                    📥 +{restockForm.quantity} uds
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Resultado Importación */}
            {importResult && (
                <div className="modal-overlay" onClick={() => setImportResult(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ margin: 16 }}>
                        <div className="modal-header">
                            <h3>📄 Importación</h3>
                            <button className="btn btn-icon btn-secondary" onClick={() => setImportResult(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--space-sm)' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>{importResult.created}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Creados</div>
                                </div>
                                <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--space-sm)' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-accent)' }}>{importResult.updated}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Actualizados</div>
                                </div>
                                <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--space-sm)' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: importResult.errors?.length ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                                        {importResult.errors?.length || 0}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Errores</div>
                                </div>
                            </div>
                            {importResult.errors?.length > 0 && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-sm)',
                                    maxHeight: 120,
                                    overflow: 'auto',
                                    fontSize: '0.75rem'
                                }}>
                                    {importResult.errors.map((err, i) => <div key={i} style={{ padding: '2px 0' }}>⚠️ {err}</div>)}
                                </div>
                            )}
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
