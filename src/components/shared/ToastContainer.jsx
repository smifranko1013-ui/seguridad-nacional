import React from 'react';

export default function ToastContainer({ toasts }) {
    if (!toasts || toasts.length === 0) return null;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    <span>{icons[toast.type] || 'ℹ️'}</span>
                    <span>{toast.message}</span>
                </div>
            ))}
        </div>
    );
}
