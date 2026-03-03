import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function MobileNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const items = [
        { path: '/', icon: '🏠', label: 'Inicio' },
        { path: '/scan', icon: '📷', label: 'Escanear' },
        { path: '/m-inventory', icon: '📦', label: 'Inventario' },
        { path: '/m-assignments', icon: '📋', label: 'Asignaciones' },
        { path: '/m-deliveries', icon: '🗂️', label: 'Entregas' },
    ];

    return (
        <nav className="mobile-nav">
            {items.map(item => (
                <button
                    key={item.path}
                    className={location.pathname === item.path ? 'active' : ''}
                    onClick={() => navigate(item.path)}
                >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
}
