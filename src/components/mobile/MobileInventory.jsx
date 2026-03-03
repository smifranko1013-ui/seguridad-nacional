import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import StockBadge from '../shared/StockBadge';

export default function MobileInventory() {
    const { products, fetchProducts } = useApp();
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchProducts({ search, category: categoryFilter });
        fetch('/api/categories').then(r => r.json()).then(setCategories).catch(() => { });
    }, [search, categoryFilter]);

    return (
        <div>
            <div className="mobile-header">
                <h1>📦 Inventario</h1>
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
                                <StockBadge quantity={p.quantity} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
