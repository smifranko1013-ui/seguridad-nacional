import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import StockBadge from '../shared/StockBadge';
import BarcodeDisplay from '../shared/BarcodeDisplay';

export default function Inventory() {
    const { products, fetchProducts, createProduct, updateProduct, deleteProduct, addToast } = useApp();
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showBarcode, setShowBarcode] = useState(null);
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({ code: '', name: '', quantity: 0, category: 'General' });

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

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este producto?')) return;
        try {
            await deleteProduct(id);
            fetchProducts({ search, category: categoryFilter });
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h2>📦 Inventario</h2>
                <div className="header-actions">
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

            {/* Modal */}
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
        </div>
    );
}
