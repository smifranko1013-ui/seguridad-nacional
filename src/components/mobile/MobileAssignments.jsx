import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import SignaturePadComponent from '../shared/SignaturePad';
import { jsPDF } from 'jspdf';

export default function MobileAssignments() {
    const { employees, fetchEmployees, getEmployeeAssignments, returnAssignment, reportDamage, addToast } = useApp();
    const [search, setSearch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [damageReason, setDamageReason] = useState('');
    const [observations, setObservations] = useState('');
    const [processing, setProcessing] = useState(false);
    const signatureRef = useRef(null);

    useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(search.toLowerCase())
    );

    const loadAssignments = async (empId) => {
        const data = await getEmployeeAssignments(empId);
        setAssignments(data);
    };

    const handleSelectEmployee = async (emp) => {
        setSelectedEmployee(emp);
        setSearch('');
        await loadAssignments(emp.id);
    };

    const activeAssignments = assignments.filter(a => a.status === 'activo');
    const pastAssignments = assignments.filter(a => a.status !== 'activo');

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
        doc.text('Empleado:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${damaged.employee_name} (${damaged.employee_code})`, 70, y);
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date().toLocaleString('es'), 70, y);
        y += 15;

        doc.setFillColor(255, 235, 235);
        doc.rect(15, y - 5, pw - 30, 35, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 0, 0);
        doc.text('ARTÍCULO DAÑADO', 20, y + 2);
        doc.setTextColor(0, 0, 0);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.text(`Producto: ${damaged.product_name}`, 25, y); y += 7;
        doc.text(`Motivo: ${damaged.change_reason}`, 25, y); y += 7;
        doc.text(`Observaciones: ${damaged.observations || 'N/A'}`, 25, y);
        y += 15;

        if (replacement) {
            doc.setFillColor(235, 255, 235);
            doc.rect(15, y - 5, pw - 30, 25, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 130, 0);
            doc.text('REEMPLAZO ENTREGADO', 20, y + 2);
            doc.setTextColor(0, 0, 0);
            y += 10;
            doc.setFont('helvetica', 'normal');
            doc.text(`Producto: ${replacement.product_name} x${replacement.quantity}`, 25, y);
            y += 15;
        }

        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text(`Generado automáticamente — ${new Date().toLocaleString('es')}`, pw / 2, y + 10, { align: 'center' });

        return doc;
    };

    const handleDamageSubmit = async () => {
        if (!damageReason.trim()) {
            addToast('Seleccione el motivo del daño', 'warning');
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

    const handleReturn = async (assignment) => {
        if (!confirm('¿Confirmar devolución de ' + assignment.product_name + '?')) return;
        try {
            await returnAssignment(assignment.id, { change_reason: 'Devolución', observations: '' });
            await loadAssignments(selectedEmployee.id);
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const statusBadge = (status) => {
        const map = {
            'activo': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '✅' },
            'dañado': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '🔴' },
            'devuelto': { color: '#8899b3', bg: 'rgba(136,153,179,0.12)', icon: '↩️' }
        };
        const s = map[status] || map['activo'];
        return (
            <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, color: s.color, backgroundColor: s.bg }}>
                {s.icon} {status}
            </span>
        );
    };

    return (
        <div>
            <div className="mobile-header">
                <h1>📋 Equipos Asignados</h1>
            </div>

            <div className="mobile-content">
                {!selectedEmployee ? (
                    <div>
                        <div className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                            <h4 style={{ marginBottom: 'var(--space-sm)' }}>👤 Buscar Empleado</h4>
                            <input
                                className="form-control"
                                placeholder="Nombre o ID del empleado..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ fontSize: '1rem', padding: '14px' }}
                            />
                        </div>
                        <div>
                            {(search ? filteredEmployees : employees.slice(0, 20)).map(emp => (
                                <div key={emp.id} className="card" onClick={() => handleSelectEmployee(emp)}
                                    style={{ padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-sm)', cursor: 'pointer' }}>
                                    <div style={{ fontWeight: 600 }}>{emp.name}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        {emp.employee_id} • {emp.position} • {emp.department}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* Employee info + back */}
                        <div className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: 'var(--color-accent)', fontSize: '1rem' }}>{selectedEmployee.name}</h3>
                                    <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                                        {selectedEmployee.employee_id} • {selectedEmployee.department}
                                    </div>
                                </div>
                                <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedEmployee(null); setAssignments([]); }}>
                                    ← Cambiar
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
                                <div style={{ textAlign: 'center', padding: '8px 16px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.1)' }}>
                                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: '1.2rem' }}>{activeAssignments.length}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Activos</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '8px 16px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)' }}>
                                    <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '1.2rem' }}>{pastAssignments.length}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Historial</div>
                                </div>
                            </div>
                        </div>

                        {/* Active items */}
                        {activeAssignments.length > 0 && (
                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>
                                    ✅ Equipos Activos
                                </h4>
                                {activeAssignments.map(a => (
                                    <div key={a.id} className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-sm)' }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{a.product_name}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                    {a.product_code} • {a.category}
                                                </div>
                                            </div>
                                            {statusBadge(a.status)}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-sm)' }}>
                                            <div><span className="text-muted">Asignado:</span> {new Date(a.assigned_at).toLocaleDateString('es')}</div>
                                            <div><span className="text-muted">Último cambio:</span> {a.last_change_date ? new Date(a.last_change_date).toLocaleDateString('es') : '—'}</div>
                                            <div><span className="text-muted">Motivo:</span> {a.change_reason || '—'}</div>
                                            <div><span className="text-muted">Cant:</span> {a.quantity}</div>
                                        </div>
                                        {a.observations && (
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                                                💬 {a.observations}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                            <button className="btn btn-sm btn-danger" style={{ flex: 2 }}
                                                onClick={() => { setSelectedAssignment(a); setDamageReason(''); setObservations(''); setShowDamageModal(true); }}>
                                                🔧 Cambio por Daño
                                            </button>
                                            <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}
                                                onClick={() => handleReturn(a)}>
                                                ↩️ Devolver
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeAssignments.length === 0 && (
                            <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center', marginBottom: 'var(--space-md)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📭</div>
                                <div className="text-muted">No tiene equipos asignados actualmente</div>
                            </div>
                        )}

                        {/* History */}
                        {pastAssignments.length > 0 && (
                            <div>
                                <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>
                                    📜 Historial
                                </h4>
                                {pastAssignments.map(a => (
                                    <div key={a.id} className="card" style={{ padding: 'var(--space-sm) var(--space-md)', marginBottom: '4px', opacity: 0.7 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{a.product_name}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                    {a.change_reason} • {a.returned_at ? new Date(a.returned_at).toLocaleDateString('es') : ''}
                                                </div>
                                            </div>
                                            {statusBadge(a.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Damage Modal */}
            {showDamageModal && selectedAssignment && (
                <div className="modal-overlay" onClick={() => setShowDamageModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h3 style={{ fontSize: '1rem' }}>🔧 Reportar Daño</h3>
                            <button className="modal-close" onClick={() => setShowDamageModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{selectedAssignment.product_name}</div>

                            <div className="form-group">
                                <label className="form-label">Motivo *</label>
                                <select className="form-control" value={damageReason} onChange={e => setDamageReason(e.target.value)}
                                    style={{ fontSize: '1rem', padding: '12px' }}>
                                    <option value="">— Seleccione —</option>
                                    <option value="Desgaste por uso">Desgaste por uso</option>
                                    <option value="Rotura">Rotura</option>
                                    <option value="Mal funcionamiento">Mal funcionamiento</option>
                                    <option value="Daño por agua">Daño por agua</option>
                                    <option value="Daño accidental">Daño accidental</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Observaciones</label>
                                <textarea className="form-control" rows="2" value={observations} onChange={e => setObservations(e.target.value)}
                                    placeholder="Detalles del daño..." style={{ fontSize: '1rem' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Firma del Empleado</label>
                                <SignaturePadComponent ref={signatureRef} height={160} />
                                <button className="btn btn-sm btn-secondary mt-sm" onClick={() => signatureRef.current?.clear()}>
                                    Borrar firma
                                </button>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDamageModal(false)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={handleDamageSubmit} disabled={processing}>
                                {processing ? '⏳...' : '🔧 Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
