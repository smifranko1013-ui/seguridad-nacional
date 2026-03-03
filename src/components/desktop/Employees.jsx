import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function Employees() {
    const { employees, fetchEmployees, createEmployee, updateEmployee, deleteEmployee, getEmployeeDetails, addToast } = useApp();
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDetail, setShowDetail] = useState(null);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [form, setForm] = useState({ employee_id: '', name: '', position: '', department: '', email: '', phone: '' });

    useEffect(() => { fetchEmployees({ search }); }, [search]);

    const openCreate = () => {
        setEditingEmployee(null);
        setForm({ employee_id: '', name: '', position: '', department: '', email: '', phone: '' });
        setShowModal(true);
    };

    const openEdit = (emp) => {
        setEditingEmployee(emp);
        setForm({
            employee_id: emp.employee_id,
            name: emp.name,
            position: emp.position,
            department: emp.department,
            email: emp.email,
            phone: emp.phone
        });
        setShowModal(true);
    };

    const viewDetails = async (emp) => {
        const details = await getEmployeeDetails(emp.id);
        setShowDetail(details);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingEmployee) {
                await updateEmployee(editingEmployee.id, form);
            } else {
                await createEmployee(form);
            }
            setShowModal(false);
            fetchEmployees({ search });
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este empleado?')) return;
        try {
            await deleteEmployee(id);
            fetchEmployees({ search });
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h2>👥 Empleados</h2>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={openCreate}>➕ Nuevo Empleado</button>
                </div>
            </div>

            <div className="content-area">
                <div className="toolbar">
                    <div className="search-bar" style={{ flex: 1 }}>
                        <span className="search-icon">🔍</span>
                        <input
                            className="form-control"
                            style={{ paddingLeft: 40 }}
                            placeholder="Buscar por nombre, ID o departamento..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre</th>
                                <th>Cargo</th>
                                <th>Departamento</th>
                                <th>Email</th>
                                <th>Teléfono</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="empty-state">
                                            <div className="empty-icon">👥</div>
                                            <p>No hay empleados registrados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                employees.map(emp => (
                                    <tr key={emp.id}>
                                        <td><code style={{ color: 'var(--color-accent)' }}>{emp.employee_id}</code></td>
                                        <td><strong>{emp.name}</strong></td>
                                        <td className="text-muted">{emp.position}</td>
                                        <td>{emp.department}</td>
                                        <td className="text-muted">{emp.email}</td>
                                        <td className="text-muted">{emp.phone}</td>
                                        <td>
                                            <div className="flex gap-sm">
                                                <button className="btn btn-sm btn-secondary" onClick={() => viewDetails(emp)} title="Ver historial">📋</button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(emp)} title="Editar">✏️</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(emp.id)} title="Eliminar">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingEmployee ? '✏️ Editar Empleado' : '➕ Nuevo Empleado'}</h3>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>ID Empleado</label>
                                        <input className="form-control" value={form.employee_id}
                                            onChange={e => setForm({ ...form, employee_id: e.target.value })}
                                            placeholder="EMP-007" required disabled={!!editingEmployee} />
                                    </div>
                                    <div className="form-group">
                                        <label>Nombre Completo</label>
                                        <input className="form-control" value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="Nombre del empleado" required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Cargo</label>
                                        <input className="form-control" value={form.position}
                                            onChange={e => setForm({ ...form, position: e.target.value })}
                                            placeholder="Ej: Agente de Seguridad" />
                                    </div>
                                    <div className="form-group">
                                        <label>Departamento</label>
                                        <select className="form-control" value={form.department}
                                            onChange={e => setForm({ ...form, department: e.target.value })}>
                                            <option value="">Seleccionar...</option>
                                            <option value="Operaciones">Operaciones</option>
                                            <option value="Logística">Logística</option>
                                            <option value="Administración">Administración</option>
                                            <option value="Tecnología">Tecnología</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input className="form-control" type="email" value={form.email}
                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                            placeholder="correo@empresa.com" />
                                    </div>
                                    <div className="form-group">
                                        <label>Teléfono</label>
                                        <input className="form-control" value={form.phone}
                                            onChange={e => setForm({ ...form, phone: e.target.value })}
                                            placeholder="555-0000" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingEmployee ? '💾 Guardar' : '➕ Registrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetail && (
                <div className="modal-overlay" onClick={() => setShowDetail(null)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📋 Historial — {showDetail.name}</h3>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowDetail(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                <div><span className="text-muted">ID:</span> <strong>{showDetail.employee_id}</strong></div>
                                <div><span className="text-muted">Cargo:</span> {showDetail.position}</div>
                                <div><span className="text-muted">Depto:</span> {showDetail.department}</div>
                                <div><span className="text-muted">Email:</span> {showDetail.email}</div>
                            </div>
                            <h4 style={{ marginBottom: 'var(--space-sm)' }}>Equipos Recibidos ({showDetail.deliveries?.length || 0})</h4>
                            {showDetail.deliveries && showDetail.deliveries.length > 0 ? (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th>Código</th>
                                                <th>Cant.</th>
                                                <th>Fecha</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {showDetail.deliveries.map(d => (
                                                <tr key={d.id}>
                                                    <td>{d.product_name}</td>
                                                    <td><code style={{ color: 'var(--color-accent)' }}>{d.product_code}</code></td>
                                                    <td>{d.quantity}</td>
                                                    <td className="text-muted">{new Date(d.created_at).toLocaleString('es')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>Sin entregas registradas</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
