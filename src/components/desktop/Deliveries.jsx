import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function Deliveries() {
    const { deliveries, fetchDeliveries, employees, fetchEmployees } = useApp();
    const [employeeFilter, setEmployeeFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        fetchEmployees();
        fetchDeliveries();
    }, []);

    const handleFilter = () => {
        const params = {};
        if (employeeFilter) params.employee_id = employeeFilter;
        if (dateFrom) params.from = dateFrom;
        if (dateTo) params.to = dateTo;
        fetchDeliveries(params);
    };

    useEffect(() => { handleFilter(); }, [employeeFilter, dateFrom, dateTo]);

    return (
        <div>
            <div className="page-header">
                <h2>📋 Historial de Entregas</h2>
            </div>

            <div className="content-area">
                <div className="toolbar">
                    <select
                        className="form-control"
                        style={{ width: 250 }}
                        value={employeeFilter}
                        onChange={e => setEmployeeFilter(e.target.value)}
                    >
                        <option value="">Todos los empleados</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
                        ))}
                    </select>
                    <input
                        className="form-control"
                        type="date"
                        style={{ width: 180 }}
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        placeholder="Desde"
                    />
                    <input
                        className="form-control"
                        type="date"
                        style={{ width: 180 }}
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        placeholder="Hasta"
                    />
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Fecha/Hora</th>
                                <th>Producto</th>
                                <th>Código</th>
                                <th>Categoría</th>
                                <th>Cant.</th>
                                <th>Empleado Receptor</th>
                                <th>Departamento</th>
                                <th>Entregó</th>
                                <th>Firma</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deliveries.length === 0 ? (
                                <tr>
                                    <td colSpan={10}>
                                        <div className="empty-state">
                                            <div className="empty-icon">📋</div>
                                            <p>No hay entregas registradas</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                deliveries.map((d, i) => (
                                    <tr key={d.id}>
                                        <td className="text-muted">{i + 1}</td>
                                        <td>
                                            <div style={{ fontSize: 'var(--font-size-sm)' }}>
                                                {new Date(d.created_at).toLocaleDateString('es')}
                                            </div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                {new Date(d.created_at).toLocaleTimeString('es')}
                                            </div>
                                        </td>
                                        <td><strong>{d.product_name}</strong></td>
                                        <td><code style={{ color: 'var(--color-accent)' }}>{d.product_code}</code></td>
                                        <td className="text-muted">{d.category}</td>
                                        <td><strong>{d.quantity}</strong></td>
                                        <td>
                                            <strong>{d.employee_name}</strong>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                {d.employee_code}
                                            </div>
                                        </td>
                                        <td className="text-muted">{d.department}</td>
                                        <td>{d.delivered_by}</td>
                                        <td>
                                            {d.signature_data ? (
                                                <span className="stock-badge optimal" style={{ cursor: 'default' }}>✓ Firmado</span>
                                            ) : (
                                                <span className="stock-badge low" style={{ cursor: 'default' }}>Sin firma</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {deliveries.length > 0 && (
                    <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        Total: <strong>{deliveries.length}</strong> entregas registradas
                    </div>
                )}
            </div>
        </div>
    );
}
