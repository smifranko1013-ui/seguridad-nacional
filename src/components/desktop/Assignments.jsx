import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import SignaturePadComponent from '../shared/SignaturePad';
import { jsPDF } from 'jspdf';

export default function Assignments() {
    const { employees, fetchEmployees, getEmployeeAssignments, returnAssignment, reportDamage, addToast } = useApp();
    const [search, setSearch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [filter, setFilter] = useState('all');
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [damageReason, setDamageReason] = useState('');
    const [observations, setObservations] = useState('');
    const [processing, setProcessing] = useState(false);
    const signatureRef = useRef(null);

    useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(search.toLowerCase()) ||
        emp.department.toLowerCase().includes(search.toLowerCase())
    );

    const loadAssignments = async (empId) => {
        const data = await getEmployeeAssignments(empId);
        setAssignments(data);
    };

    const handleSelectEmployee = async (emp) => {
        setSelectedEmployee(emp);
        await loadAssignments(emp.id);
    };

    const displayedAssignments = filter === 'all'
        ? assignments
        : assignments.filter(a => a.status === filter);

    const activeCount = assignments.filter(a => a.status === 'activo').length;
    const damagedCount = assignments.filter(a => a.status === 'dañado').length;
    const returnedCount = assignments.filter(a => a.status === 'devuelto').length;

    const openDamageModal = (assignment) => {
        setSelectedAssignment(assignment);
        setDamageReason('');
        setObservations('');
        setShowDamageModal(true);
    };

    const openReturnModal = (assignment) => {
        setSelectedAssignment(assignment);
        setDamageReason('');
        setObservations('');
        setShowReturnModal(true);
    };

    const generateExchangePDF = (damaged, replacement) => {
        const doc = new jsPDF();
        const pw = doc.internal.pageSize.getWidth();

        doc.setFillColor(10, 22, 40);
        doc.rect(0, 0, pw, 45, 'F');
        doc.setTextColor(201, 168, 76);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('SEGURIDAD NACIONAL', pw / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(136, 153, 179);
        doc.text('Acta de Cambio por Daño', pw / 2, 32, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        let y = 55;

        doc.setFont('helvetica', 'bold');
        doc.text('Fecha:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date().toLocaleString('es'), 70, y);
        y += 10;

        doc.setFont('helvetica', 'bold');
        doc.text('Empleado:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${damaged.employee_name} (${damaged.employee_code})`, 70, y);
        y += 10;

        doc.setFont('helvetica', 'bold');
        doc.text('Departamento:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(damaged.department || '', 70, y);
        y += 15;

        // Damaged item section
        doc.setFillColor(255, 235, 235);
        doc.rect(15, y - 5, pw - 30, 40, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 0, 0);
        doc.text('ARTÍCULO DAÑADO', 20, y + 2);
        doc.setTextColor(0, 0, 0);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.text(`Producto: ${damaged.product_name} (${damaged.product_code})`, 25, y); y += 7;
        doc.text(`Motivo: ${damaged.change_reason}`, 25, y); y += 7;
        doc.text(`Observaciones: ${damaged.observations || 'N/A'}`, 25, y); y += 7;
        doc.text(`Fecha de daño: ${new Date((damaged.last_change_date || '').replace(' ', 'T') + 'Z').toLocaleString('es')}`, 25, y);
        y += 15;

        if (replacement) {
            doc.setFillColor(235, 255, 235);
            doc.rect(15, y - 5, pw - 30, 30, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 130, 0);
            doc.text('ARTÍCULO DE REEMPLAZO', 20, y + 2);
            doc.setTextColor(0, 0, 0);
            y += 10;
            doc.setFont('helvetica', 'normal');
            doc.text(`Producto: ${replacement.product_name} (${replacement.product_code})`, 25, y); y += 7;
            doc.text(`Cantidad: ${replacement.quantity}`, 25, y);
            y += 15;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(180, 0, 0);
            doc.text('Sin stock disponible para reemplazo', 20, y);
            doc.setTextColor(0, 0, 0);
            y += 15;
        }

        doc.setDrawColor(200);
        doc.line(20, y, pw - 20, y);
        y += 10;

        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text('Este documento certifica el cambio de equipo por daño.', pw / 2, y, { align: 'center' });
        y += 6;
        doc.text(`Generado automáticamente — ${new Date().toLocaleString('es')}`, pw / 2, y, { align: 'center' });

        return doc;
    };

    const handleDamageSubmit = async () => {
        if (!damageReason.trim()) {
            addToast('El motivo del daño es requerido', 'warning');
            return;
        }
        setProcessing(true);
        try {
            const sigData = signatureRef.current && !signatureRef.current.isEmpty()
                ? signatureRef.current.toDataURL() : '';

            const result = await reportDamage(selectedAssignment.id, {
                change_reason: damageReason,
                observations,
                signature_data: sigData,
                auto_replace: true
            });

            // Generate PDF
            const doc = generateExchangePDF(result.damaged, result.replacement);
            doc.save(`Cambio_${selectedAssignment.id}_${Date.now()}.pdf`);

            setShowDamageModal(false);
            await loadAssignments(selectedEmployee.id);
        } catch (err) {
            addToast(err.message || 'Error al reportar daño', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleReturnSubmit = async () => {
        setProcessing(true);
        try {
            await returnAssignment(selectedAssignment.id, {
                change_reason: damageReason || 'Devolución',
                observations
            });
            setShowReturnModal(false);
            await loadAssignments(selectedEmployee.id);
        } catch (err) {
            addToast(err.message || 'Error al devolver', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const statusBadge = (status) => {
        const map = {
            'activo': { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.12)', icon: '✅' },
            'dañado': { color: 'var(--color-critical)', bg: 'rgba(239,68,68,0.12)', icon: '🔴' },
            'devuelto': { color: 'var(--color-text-muted)', bg: 'rgba(136,153,179,0.12)', icon: '↩️' }
        };
        const s = map[status] || map['activo'];
        return (
            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: s.color, backgroundColor: s.bg, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {s.icon} {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    return (
        <div>
            <div className="page-header">
                <h2>📋 Asignaciones de Equipos</h2>
                <div className="text-muted">Control de equipos asignados por empleado</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--space-lg)', alignItems: 'start' }}>
                {/* Employee search panel */}
                <div className="card" style={{ padding: 'var(--space-md)' }}>
                    <h4 style={{ marginBottom: 'var(--space-sm)' }}>👤 Buscar Empleado</h4>
                    <input
                        className="form-control"
                        placeholder="Nombre, ID o departamento..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ marginBottom: 'var(--space-sm)' }}
                    />
                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {filteredEmployees.map(emp => (
                            <div
                                key={emp.id}
                                onClick={() => handleSelectEmployee(emp)}
                                style={{
                                    padding: 'var(--space-sm) var(--space-md)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    marginBottom: '4px',
                                    backgroundColor: selectedEmployee?.id === emp.id ? 'var(--color-accent-alpha)' : 'transparent',
                                    border: selectedEmployee?.id === emp.id ? '1px solid var(--color-accent)' : '1px solid transparent',
                                    transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => { if (selectedEmployee?.id !== emp.id) e.currentTarget.style.backgroundColor = 'var(--color-bg-input)'; }}
                                onMouseLeave={e => { if (selectedEmployee?.id !== emp.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{emp.name}</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    {emp.employee_id} • {emp.position} • {emp.department}
                                </div>
                            </div>
                        ))}
                        {filteredEmployees.length === 0 && (
                            <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                No se encontraron empleados
                            </div>
                        )}
                    </div>
                </div>

                {/* Assignment details */}
                <div>
                    {!selectedEmployee ? (
                        <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>👈</div>
                            <h3 style={{ color: 'var(--color-text-muted)' }}>Seleccione un empleado</h3>
                            <p className="text-muted">Busque y seleccione un empleado para ver sus equipos asignados</p>
                        </div>
                    ) : (
                        <>
                            {/* Employee card */}
                            <div className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: 'var(--color-accent)' }}>{selectedEmployee.name}</h3>
                                    <div className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                                        {selectedEmployee.employee_id} • {selectedEmployee.position} • {selectedEmployee.department}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <div className="stat-card" style={{ padding: 'var(--space-sm) var(--space-md)', minWidth: 'auto' }}>
                                        <div className="stat-value" style={{ fontSize: '1.4rem' }}>{activeCount}</div>
                                        <div className="stat-label" style={{ fontSize: 'var(--font-size-xs)' }}>Activos</div>
                                    </div>
                                    <div className="stat-card" style={{ padding: 'var(--space-sm) var(--space-md)', minWidth: 'auto' }}>
                                        <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--color-critical)' }}>{damagedCount}</div>
                                        <div className="stat-label" style={{ fontSize: 'var(--font-size-xs)' }}>Dañados</div>
                                    </div>
                                    <div className="stat-card" style={{ padding: 'var(--space-sm) var(--space-md)', minWidth: 'auto' }}>
                                        <div className="stat-value" style={{ fontSize: '1.4rem' }}>{returnedCount}</div>
                                        <div className="stat-label" style={{ fontSize: 'var(--font-size-xs)' }}>Devueltos</div>
                                    </div>
                                </div>
                            </div>

                            {/* Filter tabs */}
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                {[['all', 'Todos', assignments.length], ['activo', 'Activos', activeCount], ['dañado', 'Dañados', damagedCount], ['devuelto', 'Devueltos', returnedCount]].map(([key, label, count]) => (
                                    <button key={key} className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFilter(key)}>
                                        {label} ({count})
                                    </button>
                                ))}
                            </div>

                            {/* Assignments table */}
                            <div className="card" style={{ overflow: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Categoría</th>
                                            <th>Cant.</th>
                                            <th>Fecha Asignación</th>
                                            <th>Último Cambio</th>
                                            <th>Motivo</th>
                                            <th>Observaciones</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedAssignments.length === 0 ? (
                                            <tr><td colSpan="9" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                                No hay asignaciones {filter !== 'all' ? `con estado "${filter}"` : ''}
                                            </td></tr>
                                        ) : displayedAssignments.map(a => (
                                            <tr key={a.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{a.product_name}</div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{a.product_code}</div>
                                                </td>
                                                <td>{a.category}</td>
                                                <td>{a.quantity}</td>
                                                <td style={{ fontSize: 'var(--font-size-xs)' }}>{new Date(a.assigned_at).toLocaleDateString('es')}</td>
                                                <td style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                                                    {a.last_change_date ? new Date(a.last_change_date).toLocaleDateString('es') : '—'}
                                                </td>
                                                <td style={{ fontSize: 'var(--font-size-xs)', maxWidth: '150px' }}>{a.change_reason || '—'}</td>
                                                <td style={{ fontSize: 'var(--font-size-xs)', maxWidth: '150px' }}>{a.observations || '—'}</td>
                                                <td>{statusBadge(a.status)}</td>
                                                <td>
                                                    {a.status === 'activo' && (
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button className="btn btn-sm btn-danger" onClick={() => openDamageModal(a)} title="Reportar Daño">
                                                                🔧 Daño
                                                            </button>
                                                            <button className="btn btn-sm btn-secondary" onClick={() => openReturnModal(a)} title="Devolver">
                                                                ↩️
                                                            </button>
                                                        </div>
                                                    )}
                                                    {a.status === 'dañado' && a.replacement_id && (
                                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>Reemplazado</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Damage Modal */}
            {showDamageModal && selectedAssignment && (
                <div className="modal-overlay" onClick={() => setShowDamageModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                        <div className="modal-header">
                            <h3>🔧 Reportar Daño y Reemplazo</h3>
                            <button className="modal-close" onClick={() => setShowDamageModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)', backgroundColor: 'var(--color-bg-input)' }}>
                                <div style={{ fontWeight: 700 }}>{selectedAssignment.product_name}</div>
                                <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                                    {selectedAssignment.product_code} • Asignado: {new Date(selectedAssignment.assigned_at).toLocaleDateString('es')}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Motivo del Daño *</label>
                                <select className="form-control" value={damageReason} onChange={e => setDamageReason(e.target.value)}>
                                    <option value="">— Seleccione motivo —</option>
                                    <option value="Desgaste por uso">Desgaste por uso</option>
                                    <option value="Rotura">Rotura</option>
                                    <option value="Mal funcionamiento">Mal funcionamiento</option>
                                    <option value="Daño por agua">Daño por agua</option>
                                    <option value="Daño accidental">Daño accidental</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                            {damageReason === 'Otro' && (
                                <div className="form-group">
                                    <label className="form-label">Especifique el motivo *</label>
                                    <input className="form-control" value="" onChange={e => setDamageReason(e.target.value)} placeholder="Describe el motivo..." />
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Observaciones</label>
                                <textarea className="form-control" rows="3" value={observations} onChange={e => setObservations(e.target.value)}
                                    placeholder="Detalles adicionales del daño, ubicación específica, etc." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Firma del Empleado (recepción de reemplazo)</label>
                                <SignaturePadComponent ref={signatureRef} height={150} />
                                <button className="btn btn-sm btn-secondary mt-sm" onClick={() => signatureRef.current?.clear()}>
                                    Borrar firma
                                </button>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDamageModal(false)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={handleDamageSubmit} disabled={processing}>
                                {processing ? '⏳ Procesando...' : '🔧 Confirmar Daño + Reemplazo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Return Modal */}
            {showReturnModal && selectedAssignment && (
                <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h3>↩️ Devolver Artículo</h3>
                            <button className="modal-close" onClick={() => setShowReturnModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)', backgroundColor: 'var(--color-bg-input)' }}>
                                <div style={{ fontWeight: 700 }}>{selectedAssignment.product_name}</div>
                                <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                                    {selectedAssignment.product_code} • Cantidad: {selectedAssignment.quantity}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Motivo de Devolución</label>
                                <select className="form-control" value={damageReason} onChange={e => setDamageReason(e.target.value)}>
                                    <option value="">— Seleccione motivo —</option>
                                    <option value="Fin de contrato">Fin de contrato</option>
                                    <option value="Cambio de puesto">Cambio de puesto</option>
                                    <option value="Renuncia">Renuncia</option>
                                    <option value="Vacaciones">Vacaciones</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Observaciones</label>
                                <textarea className="form-control" rows="2" value={observations} onChange={e => setObservations(e.target.value)}
                                    placeholder="Notas adicionales..." />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleReturnSubmit} disabled={processing}>
                                {processing ? '⏳...' : '↩️ Confirmar Devolución'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
