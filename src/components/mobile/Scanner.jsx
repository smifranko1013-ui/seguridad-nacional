import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import BarcodeDisplay from '../shared/BarcodeDisplay';
import SignaturePadComponent from '../shared/SignaturePad';
import { jsPDF } from 'jspdf';

const STEPS = ['scan', 'product', 'employee', 'signature', 'complete'];

export default function Scanner() {
    const { employees, fetchEmployees, getProductByCode, createDelivery, addToast } = useApp();
    const [step, setStep] = useState('scan');
    const [manualCode, setManualCode] = useState('');
    const [scannedProduct, setScannedProduct] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [signatureData, setSignatureData] = useState('');
    const [deliveryResult, setDeliveryResult] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const signatureRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const quaggaActive = useRef(false);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // Camera-based barcode scanning
    const startScanning = useCallback(async () => {
        setIsScanning(true);
        try {
            const Quagga = (await import('@ericblade/quagga2')).default;

            await Quagga.init({
                inputStream: {
                    type: 'LiveStream',
                    target: document.querySelector('#scanner-container'),
                    constraints: {
                        facingMode: 'environment',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                },
                decoder: {
                    readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'code_39_reader']
                },
                locate: true,
                frequency: 5
            });

            Quagga.start();
            quaggaActive.current = true;

            Quagga.onDetected(async (result) => {
                if (!quaggaActive.current) return;
                const code = result.codeResult.code;
                if (code) {
                    quaggaActive.current = false;
                    Quagga.stop();
                    setIsScanning(false);
                    await handleCodeScanned(code);
                }
            });
        } catch (err) {
            console.error('Scanner error:', err);
            setIsScanning(false);
            addToast('No se pudo acceder a la cámara. Use entrada manual.', 'warning');
        }
    }, [addToast]);

    const stopScanning = useCallback(async () => {
        try {
            const Quagga = (await import('@ericblade/quagga2')).default;
            if (quaggaActive.current) {
                Quagga.stop();
                quaggaActive.current = false;
            }
        } catch (err) { /* ignore */ }
        setIsScanning(false);
    }, []);

    useEffect(() => {
        return () => { stopScanning(); };
    }, [stopScanning]);

    const handleCodeScanned = async (code) => {
        const product = await getProductByCode(code);
        if (product) {
            setScannedProduct(product);
            setStep('product');
            addToast(`Producto encontrado: ${product.name}`, 'success');
        } else {
            addToast(`Código no encontrado: ${code}`, 'error');
        }
    };

    const handleManualSearch = async () => {
        if (!manualCode.trim()) return;
        await handleCodeScanned(manualCode.trim());
    };

    const handleEmployeeSelect = (empId) => {
        const emp = employees.find(e => e.id === parseInt(empId));
        setSelectedEmployee(emp);
    };

    const handleConfirmEmployee = () => {
        if (!selectedEmployee) {
            addToast('Seleccione un empleado', 'warning');
            return;
        }
        setStep('signature');
    };

    const handleSignatureEnd = (data) => {
        setSignatureData(data);
    };

    const generatePDF = (delivery) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(10, 22, 40);
        doc.rect(0, 0, pageWidth, 45, 'F');
        doc.setTextColor(201, 168, 76);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('SEGURIDAD NACIONAL', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(136, 153, 179);
        doc.text('Certificado de Entrega de Equipo', pageWidth / 2, 32, { align: 'center' });

        // Content
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        let y = 60;

        // Delivery ID
        doc.setFont('helvetica', 'bold');
        doc.text('No. de Entrega:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`#${delivery.id}`, 80, y);
        y += 10;

        // Date
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha y Hora:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date(delivery.created_at).toLocaleString('es'), 80, y);
        y += 15;

        // Product section
        doc.setFillColor(240, 240, 240);
        doc.rect(15, y - 5, pageWidth - 30, 35, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('PRODUCTO ENTREGADO', 20, y + 2);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.text(`Nombre: ${delivery.product_name}`, 25, y);
        y += 7;
        doc.text(`Código: ${delivery.product_code}`, 25, y);
        y += 7;
        doc.text(`Categoría: ${delivery.category}`, 25, y);
        y += 7;
        doc.text(`Cantidad: ${delivery.quantity}`, 25, y);
        y += 15;

        // Employee section
        doc.setFillColor(240, 240, 240);
        doc.rect(15, y - 5, pageWidth - 30, 28, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('EMPLEADO RECEPTOR', 20, y + 2);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.text(`Nombre: ${delivery.employee_name}`, 25, y);
        y += 7;
        doc.text(`ID: ${delivery.employee_code} — Depto: ${delivery.department}`, 25, y);
        y += 15;

        // Delivered by
        doc.setFont('helvetica', 'bold');
        doc.text('Entregado por:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(delivery.delivered_by || 'Sistema', 80, y);
        y += 15;

        // Signature
        if (delivery.signature_data) {
            doc.setFont('helvetica', 'bold');
            doc.text('Firma del Receptor:', 20, y);
            y += 5;
            try {
                doc.addImage(delivery.signature_data, 'PNG', 20, y, 80, 40);
            } catch (e) { /* ignore */ }
            y += 45;
        }

        // Line
        doc.setDrawColor(200, 200, 200);
        doc.line(20, y, pageWidth - 20, y);
        y += 10;

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text('Este documento certifica la entrega del equipo descrito.', pageWidth / 2, y, { align: 'center' });
        y += 6;
        doc.text(`Generado automáticamente — ${new Date().toLocaleString('es')}`, pageWidth / 2, y, { align: 'center' });

        return doc;
    };

    const handleFinalize = async () => {
        if (!signatureData && signatureRef.current && !signatureRef.current.isEmpty()) {
            setSignatureData(signatureRef.current.toDataURL());
        }

        const finalSignature = signatureData || (signatureRef.current ? signatureRef.current.toDataURL() : '');

        if (!finalSignature || (signatureRef.current && signatureRef.current.isEmpty())) {
            addToast('La firma es requerida', 'warning');
            return;
        }

        setIsProcessing(true);
        try {
            const delivery = await createDelivery({
                product_id: scannedProduct.id,
                employee_id: selectedEmployee.id,
                quantity: 1,
                signature_data: finalSignature,
                delivered_by: 'Bodeguero',
                notes: ''
            });

            setDeliveryResult(delivery);

            // Generate and download PDF
            const doc = generatePDF(delivery);
            doc.save(`Entrega_${delivery.id}_${delivery.employee_code}_${Date.now()}.pdf`);

            setStep('complete');
            addToast('¡Entrega completada! PDF generado.', 'success');
        } catch (err) {
            addToast(err.message || 'Error al registrar la entrega', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const resetFlow = () => {
        setStep('scan');
        setScannedProduct(null);
        setSelectedEmployee(null);
        setSignatureData('');
        setDeliveryResult(null);
        setManualCode('');
    };

    const currentStepIndex = STEPS.indexOf(step);

    return (
        <div>
            <div className="mobile-header">
                <h1>📷 Escanear y Entregar</h1>
            </div>

            {/* Progress Steps */}
            <div className="delivery-steps">
                {['Escaneo', 'Producto', 'Empleado', 'Firma', 'Listo'].map((label, i) => (
                    <React.Fragment key={label}>
                        {i > 0 && <div className={`step-connector ${currentStepIndex > i - 1 ? 'completed' : ''}`} />}
                        <div className={`delivery-step ${currentStepIndex === i ? 'active' : ''} ${currentStepIndex > i ? 'completed' : ''}`}>
                            <div className="step-circle">
                                {currentStepIndex > i ? '✓' : i + 1}
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>

            <div className="mobile-content">
                {/* STEP 1: Scan */}
                {step === 'scan' && (
                    <div>
                        <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center', marginBottom: 'var(--space-md)' }}>
                            <div id="scanner-container" className="scanner-viewport" style={{ minHeight: isScanning ? 300 : 'auto', marginBottom: 'var(--space-md)' }}>
                                {!isScanning && (
                                    <div style={{ padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-sm)' }}>📷</div>
                                        <p style={{ fontSize: 'var(--font-size-sm)' }}>Apunte la cámara al código de barras</p>
                                    </div>
                                )}
                            </div>
                            <button className="btn btn-primary btn-lg w-full" onClick={isScanning ? stopScanning : startScanning}>
                                {isScanning ? '⏹️ Detener Cámara' : '📷 Iniciar Cámara'}
                            </button>
                        </div>

                        <div className="card" style={{ padding: 'var(--space-lg)' }}>
                            <h4 style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>⌨️ Entrada Manual</h4>
                            <div className="flex gap-sm">
                                <input
                                    className="form-control"
                                    placeholder="Ingrese código del producto..."
                                    value={manualCode}
                                    onChange={e => setManualCode(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                                    style={{ flex: 1 }}
                                />
                                <button className="btn btn-primary" onClick={handleManualSearch}>🔍</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: Product Info */}
                {step === 'product' && scannedProduct && (
                    <div>
                        <div className="card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <h3 style={{ marginBottom: 'var(--space-md)', color: 'var(--color-accent)' }}>✅ Producto Identificado</h3>
                            <div style={{ marginBottom: 'var(--space-sm)' }}>
                                <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Nombre</div>
                                <div style={{ fontWeight: 700 }}>{scannedProduct.name}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                <div>
                                    <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Código</div>
                                    <code style={{ color: 'var(--color-accent)' }}>{scannedProduct.code}</code>
                                </div>
                                <div>
                                    <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Categoría</div>
                                    <div>{scannedProduct.category}</div>
                                </div>
                                <div>
                                    <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Stock Disponible</div>
                                    <div style={{ fontWeight: 700, color: scannedProduct.quantity < 10 ? 'var(--color-critical)' : 'var(--color-success)' }}>
                                        {scannedProduct.quantity} unidades
                                    </div>
                                </div>
                            </div>
                            <BarcodeDisplay value={scannedProduct.code} height={45} />
                        </div>

                        {scannedProduct.quantity < 1 ? (
                            <div className="alert-banner danger" style={{ marginBottom: 'var(--space-md)' }}>
                                ❌ Sin stock disponible para este producto
                            </div>
                        ) : (
                            <div className="flex gap-sm">
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={resetFlow}>← Volver</button>
                                <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep('employee')}>
                                    Seleccionar Empleado →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: Employee Selection */}
                {step === 'employee' && (
                    <div>
                        <div className="card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>👤 Seleccionar Empleado Receptor</h3>
                            <select
                                className="form-control"
                                value={selectedEmployee?.id || ''}
                                onChange={e => handleEmployeeSelect(e.target.value)}
                                style={{ marginBottom: 'var(--space-md)', fontSize: '1rem', padding: '14px' }}
                            >
                                <option value="">— Seleccione un empleado —</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} — {emp.position} ({emp.employee_id})
                                    </option>
                                ))}
                            </select>

                            {selectedEmployee && (
                                <div className="card" style={{ padding: 'var(--space-md)', backgroundColor: 'var(--color-bg-input)' }}>
                                    <div style={{ fontWeight: 700 }}>{selectedEmployee.name}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        {selectedEmployee.position} • {selectedEmployee.department}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        ID: {selectedEmployee.employee_id} • {selectedEmployee.email}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-sm">
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('product')}>← Volver</button>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleConfirmEmployee}>
                                Firmar Entrega →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: Signature */}
                {step === 'signature' && (
                    <div>
                        <div className="card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>✍️ Firma Digital</h3>
                            <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
                                El empleado <strong className="text-accent">{selectedEmployee?.name}</strong> debe firmar para confirmar la recepción de <strong className="text-accent">{scannedProduct?.name}</strong>.
                            </p>

                            <SignaturePadComponent ref={signatureRef} onEnd={handleSignatureEnd} height={220} />

                            <button
                                className="btn btn-secondary btn-sm mt-sm"
                                onClick={() => { signatureRef.current?.clear(); setSignatureData(''); }}
                            >
                                🗑️ Borrar Firma
                            </button>
                        </div>

                        <div className="flex gap-sm">
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('employee')}>← Volver</button>
                            <button
                                className="btn btn-success btn-lg"
                                style={{ flex: 2 }}
                                onClick={handleFinalize}
                                disabled={isProcessing}
                            >
                                {isProcessing ? '⏳ Procesando...' : '✅ Confirmar Entrega'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 5: Complete */}
                {step === 'complete' && deliveryResult && (
                    <div>
                        <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
                            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>🎉</div>
                            <h2 style={{ color: 'var(--color-success)', marginBottom: 'var(--space-sm)' }}>¡Entrega Completada!</h2>
                            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
                                El equipo ha sido entregado y registrado exitosamente.
                            </p>

                            <div style={{ textAlign: 'left', marginBottom: 'var(--space-lg)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
                                    <div><span className="text-muted">Entrega #</span><br /><strong>{deliveryResult.id}</strong></div>
                                    <div><span className="text-muted">Fecha</span><br />{new Date(deliveryResult.created_at).toLocaleString('es')}</div>
                                    <div><span className="text-muted">Producto</span><br /><strong>{deliveryResult.product_name}</strong></div>
                                    <div><span className="text-muted">Empleado</span><br /><strong>{deliveryResult.employee_name}</strong></div>
                                </div>
                            </div>

                            <div className="flex gap-sm" style={{ justifyContent: 'center' }}>
                                <button className="btn btn-primary btn-lg" onClick={resetFlow}>
                                    📷 Nueva Entrega
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
