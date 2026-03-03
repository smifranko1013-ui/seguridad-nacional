import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import StockBadge from '../shared/StockBadge';

export default function Dashboard() {
    const navigate = useNavigate();
    const { stats, fetchStats, loading } = useApp();

    useEffect(() => { fetchStats(); }, []);

    if (loading || !stats) {
        return (
            <div>
                <div className="page-header"><h2>📊 Dashboard</h2></div>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h2>📊 Dashboard</h2>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => navigate('/inventory')}>
                        ➕ Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card accent">
                    <div className="stat-icon">📦</div>
                    <div className="stat-value">{stats.totalProducts}</div>
                    <div className="stat-label">Productos Registrados</div>
                </div>
                <div className="stat-card info">
                    <div className="stat-icon">🏷️</div>
                    <div className="stat-value">{stats.totalItems}</div>
                    <div className="stat-label">Unidades en Stock</div>
                </div>
                <div className="stat-card success">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats.totalEmployees}</div>
                    <div className="stat-label">Empleados</div>
                </div>
                <div className="stat-card warning">
                    <div className="stat-icon">📋</div>
                    <div className="stat-value">{stats.totalDeliveries}</div>
                    <div className="stat-label">Entregas Realizadas</div>
                </div>
            </div>

            {/* Alert Summary */}
            <div className="content-area" style={{ paddingTop: 0 }}>
                <div className="stats-grid" style={{ padding: 0 }}>
                    <div className="stat-card danger" style={{ cursor: 'pointer' }} onClick={() => navigate('/orders')}>
                        <div className="stat-icon">🔴</div>
                        <div className="stat-value">{stats.criticalStock}</div>
                        <div className="stat-label">Stock Crítico (&lt;10)</div>
                    </div>
                    <div className="stat-card warning" style={{ cursor: 'pointer' }} onClick={() => navigate('/orders')}>
                        <div className="stat-icon">🟠</div>
                        <div className="stat-value">{stats.lowStock}</div>
                        <div className="stat-label">Stock Bajo (&lt;20)</div>
                    </div>
                    <div className="stat-card success">
                        <div className="stat-icon">🟢</div>
                        <div className="stat-value">{stats.optimalStock}</div>
                        <div className="stat-label">Stock Óptimo (≥20)</div>
                    </div>
                </div>

                {/* Low Stock Alert */}
                {stats.lowStockProducts && stats.lowStockProducts.length > 0 && (
                    <div className="mt-lg">
                        <h3 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ⚠️ Productos con Stock bajo
                        </h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Producto</th>
                                        <th>Categoría</th>
                                        <th>Stock</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.lowStockProducts.map(p => (
                                        <tr key={p.id}>
                                            <td><code style={{ color: 'var(--color-accent)' }}>{p.code}</code></td>
                                            <td>{p.name}</td>
                                            <td className="text-muted">{p.category}</td>
                                            <td><strong>{p.quantity}</strong></td>
                                            <td><StockBadge quantity={p.quantity} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Recent Deliveries */}
                {stats.recentDeliveries && stats.recentDeliveries.length > 0 && (
                    <div className="mt-lg">
                        <h3 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📋 Últimas Entregas
                        </h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Empleado</th>
                                        <th>Cantidad</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentDeliveries.map(d => (
                                        <tr key={d.id}>
                                            <td>{d.product_name}</td>
                                            <td>{d.employee_name}</td>
                                            <td>{d.quantity}</td>
                                            <td className="text-muted">{new Date((d.created_at || '').replace(' ', 'T') + 'Z').toLocaleString('es')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
