import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import StockBadge from '../shared/StockBadge';
import BarcodeDisplay from '../shared/BarcodeDisplay';

export default function Orders() {
    const { stats, fetchStats } = useApp();

    useEffect(() => { fetchStats(); }, []);

    if (!stats) return <div className="loading-spinner" />;

    const lowStockProducts = stats.lowStockProducts || [];
    const critical = lowStockProducts.filter(p => p.quantity < 10);
    const low = lowStockProducts.filter(p => p.quantity >= 10 && p.quantity < 20);

    const suggestOrder = (qty) => {
        if (qty < 5) return 50;
        if (qty < 10) return 30;
        if (qty < 15) return 20;
        return 10;
    };

    return (
        <div>
            <div className="page-header">
                <h2>🚨 Necesidad de Pedido</h2>
            </div>

            <div className="content-area">
                {lowStockProducts.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>✅</div>
                        <h3>¡Todo en orden!</h3>
                        <p className="text-muted mt-sm">Todos los productos tienen stock óptimo. No se requieren pedidos.</p>
                    </div>
                ) : (
                    <>
                        {/* Summary */}
                        <div className="stats-grid" style={{ padding: 0, marginBottom: 'var(--space-lg)' }}>
                            <div className="stat-card danger">
                                <div className="stat-icon">🔴</div>
                                <div className="stat-value">{critical.length}</div>
                                <div className="stat-label">Pedido Urgente (&lt;10 unidades)</div>
                            </div>
                            <div className="stat-card warning">
                                <div className="stat-icon">🟠</div>
                                <div className="stat-value">{low.length}</div>
                                <div className="stat-label">Pedido Recomendado (&lt;20 unidades)</div>
                            </div>
                        </div>

                        {/* Critical */}
                        {critical.length > 0 && (
                            <div className="mb-md">
                                <div className="alert-banner danger" style={{ marginBottom: 'var(--space-md)' }}>
                                    🔴 <strong>URGENTE</strong> — Los siguientes productos necesitan reposición inmediata
                                </div>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Producto</th>
                                                <th>Categoría</th>
                                                <th>Stock Actual</th>
                                                <th>Estado</th>
                                                <th>Pedido Sugerido</th>
                                                <th>Código de Barras</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {critical.map(p => (
                                                <tr key={p.id}>
                                                    <td><code style={{ color: 'var(--color-accent)' }}>{p.code}</code></td>
                                                    <td><strong>{p.name}</strong></td>
                                                    <td className="text-muted">{p.category}</td>
                                                    <td><strong style={{ color: 'var(--color-critical)' }}>{p.quantity}</strong></td>
                                                    <td><StockBadge quantity={p.quantity} /></td>
                                                    <td><strong style={{ color: 'var(--color-success)' }}>+{suggestOrder(p.quantity)}</strong></td>
                                                    <td><BarcodeDisplay value={p.code} height={30} fontSize={10} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Low */}
                        {low.length > 0 && (
                            <div>
                                <div className="alert-banner warning" style={{ marginBottom: 'var(--space-md)' }}>
                                    🟠 <strong>ATENCIÓN</strong> — Los siguientes productos tienen stock bajo
                                </div>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Producto</th>
                                                <th>Categoría</th>
                                                <th>Stock Actual</th>
                                                <th>Estado</th>
                                                <th>Pedido Sugerido</th>
                                                <th>Código de Barras</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {low.map(p => (
                                                <tr key={p.id}>
                                                    <td><code style={{ color: 'var(--color-accent)' }}>{p.code}</code></td>
                                                    <td><strong>{p.name}</strong></td>
                                                    <td className="text-muted">{p.category}</td>
                                                    <td><strong style={{ color: 'var(--color-low)' }}>{p.quantity}</strong></td>
                                                    <td><StockBadge quantity={p.quantity} /></td>
                                                    <td><strong style={{ color: 'var(--color-success)' }}>+{suggestOrder(p.quantity)}</strong></td>
                                                    <td><BarcodeDisplay value={p.code} height={30} fontSize={10} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
