import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

export default function MobileHome() {
    const navigate = useNavigate();
    const { stats } = useApp();

    return (
        <div>
            <div className="mobile-header">
                <h1>🛡️ Seguridad Nacional</h1>
                <div className="subtitle">Gestión de Inventario</div>
            </div>

            {/* Stats preview */}
            {stats && (
                <div className="stats-grid" style={{ padding: 'var(--space-md)' }}>
                    <div className="stat-card accent">
                        <div className="stat-value">{stats.totalItems}</div>
                        <div className="stat-label">Unidades en Stock</div>
                    </div>
                    <div className="stat-card danger">
                        <div className="stat-value">{stats.criticalStock + stats.lowStock}</div>
                        <div className="stat-label">Alertas Activas</div>
                    </div>
                </div>
            )}

            {/* Action Grid */}
            <div className="mobile-action-grid">
                <button className="mobile-action-btn primary" onClick={() => navigate('/scan')}>
                    <span className="action-icon">📷</span>
                    <span className="action-label">Escanear y Entregar</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Escaneo de código → Firma → Entrega
                    </span>
                </button>
                <button className="mobile-action-btn" onClick={() => navigate('/m-inventory')}>
                    <span className="action-icon">📦</span>
                    <span className="action-label">Inventario</span>
                </button>
                <button className="mobile-action-btn" onClick={() => navigate('/m-assignments')}>
                    <span className="action-icon">📋</span>
                    <span className="action-label">Equipos Asignados</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Ver y cambiar equipos por empleado
                    </span>
                </button>
                <button className="mobile-action-btn" onClick={() => navigate('/m-deliveries')}>
                    <span className="action-icon">🗂️</span>
                    <span className="action-label">Entregas</span>
                </button>
            </div>

            {/* Quick Alerts */}
            {stats && stats.lowStockProducts && stats.lowStockProducts.length > 0 && (
                <div style={{ padding: 'var(--space-md)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>
                        ⚠️ Alertas de Stock
                    </h3>
                    {stats.lowStockProducts.slice(0, 4).map(p => (
                        <div key={p.id} className="card" style={{ marginBottom: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{p.name}</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{p.code}</div>
                            </div>
                            <span className={`stock-badge ${p.quantity < 10 ? 'critical' : 'low'}`}>
                                <span className="pulse" />
                                {p.quantity}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
