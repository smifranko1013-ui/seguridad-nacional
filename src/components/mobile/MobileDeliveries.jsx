import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function MobileDeliveries() {
    const { deliveries, fetchDeliveries } = useApp();

    useEffect(() => { fetchDeliveries(); }, []);

    return (
        <div>
            <div className="mobile-header">
                <h1>📋 Entregas</h1>
            </div>
            <div className="mobile-content">
                {deliveries.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <p>No hay entregas registradas</p>
                    </div>
                ) : (
                    deliveries.map(d => (
                        <div key={d.id} className="card" style={{ marginBottom: 'var(--space-sm)', padding: 'var(--space-md)' }}>
                            <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                                <strong style={{ fontSize: 'var(--font-size-sm)' }}>{d.product_name}</strong>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    ×{d.quantity}
                                </span>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                👤 {d.employee_name} ({d.employee_code})
                            </div>
                            <div className="flex justify-between items-center" style={{ marginTop: 6 }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    🕐 {new Date((d.created_at || '').replace(' ', 'T') + 'Z').toLocaleString('es')}
                                </span>
                                {d.signature_data ? (
                                    <span className="stock-badge optimal" style={{ fontSize: 'var(--font-size-xs)' }}>✓ Firmado</span>
                                ) : (
                                    <span className="stock-badge low" style={{ fontSize: 'var(--font-size-xs)' }}>Sin firma</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
