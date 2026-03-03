import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { stats } = useApp();

    const navItems = [
        { path: '/', icon: '📊', label: 'Dashboard' },
        { path: '/inventory', icon: '📦', label: 'Inventario' },
        { path: '/employees', icon: '👥', label: 'Empleados' },
        { path: '/deliveries', icon: '📋', label: 'Entregas' },
        { path: '/orders', icon: '🚨', label: 'Necesidad de Pedido', badge: stats ? stats.criticalStock + stats.lowStock : 0 },
        { path: '/assignments', icon: '📋', label: 'Asignaciones' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <h1>🛡️ Seguridad Nacional</h1>
                <div className="subtitle">Sistema de Inventario</div>
            </div>
            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <button
                        key={item.path}
                        className={location.pathname === item.path ? 'active' : ''}
                        onClick={() => navigate(item.path)}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                        {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                    </button>
                ))}
            </nav>
            <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    v1.0.0 — Seguridad Nacional<br />
                    © 2026 Todos los derechos reservados
                </div>
            </div>
        </aside>
    );
}
