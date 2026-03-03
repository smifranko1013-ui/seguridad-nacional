import React from 'react';

export default function StockBadge({ quantity }) {
    let level, label;
    if (quantity < 10) {
        level = 'critical';
        label = 'Crítico';
    } else if (quantity < 20) {
        level = 'low';
        label = 'Bajo';
    } else {
        level = 'optimal';
        label = 'Óptimo';
    }

    return (
        <span className={`stock-badge ${level}`}>
            <span className="pulse" />
            {quantity} — {label}
        </span>
    );
}
