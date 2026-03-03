import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import BarcodeDisplay from '../shared/BarcodeDisplay';
import SignaturePadComponent from '../shared/SignaturePad';
import { jsPDF } from 'jspdf';

const STEPS = ['employee', 'scan', 'review', 'signature', 'complete'];

export default function Scanner() {
    const { employees, fetchEmployees, getProductByCode, createBulkDelivery, addToast } = useApp();
    const [step, setStep] = useState('employee');
    const [searchEmployee, setSearchEmployee] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [manualCode, setManualCode] = useState('');
    const [scannedProducts, setScannedProducts] = useState([]); // [{ product, quantity }]
    const [signatureData, setSignatureData] = useState('');
    const [deliveryResult, setDeliveryResult] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const signatureRef = useRef(null);
    const quaggaActive = useRef(false);

    // Web Audio API beep
    const audioCtxRef = useRef(null);
    const playBeep = useCallback(() => {
        try {
            if (!audioCtxRef.current) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                audioCtxRef.current = new AudioContext();
            }
            const ctx = audioCtxRef.current;

            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            // Use square wave for a harsher, more "barcode scanner-like" sound or sine for clean beep.
            // A mix or high-freq sine works best.
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(2500, ctx.currentTime); // Much higher pitch

            gainNode.gain.setValueAtTime(1.0, ctx.currentTime); // Max volume
            // Slightly longer fade out so it's not cut off too abruptly
            gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.15);
        } catch (e) {
            console.error('Audio play failed:', e);
        }
    }, []);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // --------- STEP 1: EMPLOYEE SEARCH ---------
    const filteredEmployees = employees.filter(e =>
        e.name.toLowerCase().includes(searchEmployee.toLowerCase()) ||
        e.employee_id.includes(searchEmployee)
    );

    const handleEmployeeSelect = (emp) => {
        setSelectedEmployee(emp);
        setStep('scan');
    };

    // --------- STEP 2: SCAN ---------
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

            // Debounce variable to avoid multi-scans of the same barcode in rapid succession
            let lastCode = '';
            let lastScanTime = 0;

            Quagga.onDetected(async (result) => {
                if (!quaggaActive.current) return;
                const code = result.codeResult.code;
                const now = Date.now();

                if (code) {
                    if (code === lastCode && now - lastScanTime < 2000) return; // 2 seconds debounce
                    lastCode = code;
                    lastScanTime = now;
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
        if (step === 'scan') {
            startScanning();
        } else {
            stopScanning();
        }
        return () => stopScanning();
    }, [step, startScanning, stopScanning]);

    const handleCodeScanned = async (code) => {
        const product = await getProductByCode(code);
        if (product) {
            // Play beep
            playBeep();

            setScannedProducts(current => {
                const existingIndex = current.findIndex(item => item.product.id === product.id);
                if (existingIndex >= 0) {
                    const newList = [...current];
                    newList[existingIndex].quantity += 1;
                    addToast(`Agregado: ${product.name} (Cant: ${newList[existingIndex].quantity})`, 'success');
                    return newList;
                } else {
                    addToast(`Producto agregado: ${product.name}`, 'success');
                    return [{ product, quantity: 1 }, ...current]; // Add to top for better visibility
                }
            });
        } else {
            addToast(`Código no encontrado: ${code}`, 'error');
        }
    };

    const handleManualSearch = async () => {
        if (!manualCode.trim()) return;
        await handleCodeScanned(manualCode.trim());
        setManualCode('');
    };

    // --------- STEP 3: REVIEW ---------
    const updateQuantity = (productId, delta) => {
        setScannedProducts(current => current.map(item => {
            if (item.product.id === productId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }));
    };

    const removeProduct = (productId) => {
        setScannedProducts(current => current.filter(item => item.product.id !== productId));
    };

    // --------- STEP 4 & 5: SIGNATURE & REVISION ---------
    const generatePDF = (deliveriesArr) => {
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
        doc.text('Formato de Asignación / Entrega Múltiple', pageWidth / 2, 32, { align: 'center' });

        // Content
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        let y = 60;

        // Delivery Info (assume all share same timestamp and employee)
        const baseDelivery = deliveriesArr[0];

        doc.setFont('helvetica', 'bold');
        doc.text('ID Asignación Múltiple:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`MULTI-${baseDelivery.id}-${new Date(baseDelivery.created_at).getTime().toString().substr(-6)}`, 80, y);
        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha / Hora:', 20, y);
        doc.setFont('helvetica', 'normal');
        // Fix timezone by replacing space with T and adding Z to force UTC parsing
        const dateStr = baseDelivery.created_at ? baseDelivery.created_at.replace(' ', 'T') + 'Z' : new Date();
        doc.text(new Date(dateStr).toLocaleString('es'), 80, y);
        y += 15;

        // Employee section
        doc.setFillColor(240, 240, 240);
        doc.rect(15, y - 5, pageWidth - 30, 28, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('EMPLEADO RECEPTOR', 20, y + 2);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.text(`Nombre: ${baseDelivery.employee_name}`, 25, y);
        y += 7;
        doc.text(`Cédula: ${baseDelivery.employee_code} — Depto: ${baseDelivery.department}`, 25, y);
        y += 15;

        // Delivered by
        doc.setFont('helvetica', 'bold');
        doc.text('Entregado por:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(baseDelivery.delivered_by || 'Bodeguero Operativo', 80, y);
        y += 15;

        // Products List
        doc.setFont('helvetica', 'bold');
        doc.text('EQUIPOS / ELEMENTOS ASIGNADOS', 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setDrawColor(200);
        doc.line(20, y - 4, pageWidth - 20, y - 4);

        doc.text('CÓDIGO', 22, y);
        doc.text('DESCRIPCIÓN', 60, y);
        doc.text('CATEGORÍA', 140, y);
        doc.text('CANT', 180, y);
        y += 5;
        doc.line(20, y - 4, pageWidth - 20, y - 4);

        doc.setFont('helvetica', 'normal');
        deliveriesArr.forEach(d => {
            if (y > 250) {
                doc.addPage();
                y = 20;
            }
            // Clip strings if too long
            const nameStr = d.product_name.length > 40 ? d.product_name.substring(0, 38) + '...' : d.product_name;
            const codeStr = d.product_code.length > 15 ? d.product_code.substring(0, 13) + '..' : d.product_code;
            const catStr = d.category.length > 15 ? d.category.substring(0, 13) + '..' : d.category;

            doc.text(codeStr, 22, y);
            doc.text(nameStr, 60, y);
            doc.text(catStr, 140, y);
            doc.text(d.quantity.toString(), 180, y);
            y += 6;
        });

        doc.line(20, y - 2, pageWidth - 20, y - 2);
        y += 15;

        // Signature
        if (baseDelivery.signature_data) {
            if (y > 220) { doc.addPage(); y = 20; }
            doc.setFont('helvetica', 'bold');
            doc.text('Firma del Receptor (Acepta responsabilidad sobre los equipos):', 20, y);
            y += 5;
            try {
                doc.addImage(baseDelivery.signature_data, 'PNG', 20, y, 80, 40);
            } catch (e) { /* ignore */ }
            y += 45;
        }

        doc.setDrawColor(200, 200, 200);
        doc.line(20, y, pageWidth - 20, y);
        y += 10;

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('Este documento certifica la entrega técnica y asignación de los equipos descritos amparado al perfil del empleado.', pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.text(`Generado automáticamente — ${new Date().toLocaleString('es')}`, pageWidth / 2, y, { align: 'center' });

        return doc;
    };

    const handleFinalize = async () => {
        if (!signatureData && signatureRef.current && !signatureRef.current.isEmpty()) {
            setSignatureData(signatureRef.current.toDataURL());
        }

        const finalSignature = signatureData || (signatureRef.current ? signatureRef.current.toDataURL() : '');

        if (!finalSignature || (signatureRef.current && signatureRef.current.isEmpty())) {
            addToast('La firma es obligatoria para certificar la entrega', 'warning');
            return;
        }

        setIsProcessing(true);
        try {
            const productPayload = scannedProducts.map(item => ({
                id: item.product.id,
                quantity: item.quantity
            }));

            const deliveries = await createBulkDelivery({
                employee_id: selectedEmployee.id,
                products: productPayload,
                signature_data: finalSignature,
                delivered_by: 'Bodeguero Operativo',
                notes: 'Asignación masiva vía Scanner Móvil'
            });

            setDeliveryResult(deliveries);

            // Generate and download combined PDF
            if (deliveries && deliveries.length > 0) {
                const doc = generatePDF(deliveries);
                doc.save(`Asignacion_${selectedEmployee.employee_id}_${Date.now()}.pdf`);
            }

            setStep('complete');
            addToast('¡Equipos asignados y PDF generado!', 'success');
        } catch (err) {
            addToast(err.message || 'Error al registrar la entrega masiva', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const resetScanner = () => {
        setStep('employee');
        setSelectedEmployee(null);
        setScannedProducts([]);
        setSignatureData('');
        setDeliveryResult(null);
        setManualCode('');
    };

    return (
        <div className="scanner-page">
            <div className="scanner-header">
                <h2>{
                    step === 'employee' ? '👤 Seleccionar Empleado' :
                        step === 'scan' ? '📷 Escanear Equipos' :
                            step === 'review' ? '📝 Revisar Asignación' :
                                step === 'signature' ? '✍️ Firma del Empleado' :
                                    '✅ Asignación Completa'
                }</h2>
                {step !== 'complete' && <button className="btn btn-secondary btn-sm" onClick={resetScanner}>Cancelar</button>}
            </div>

            {/* PROGRESS BAR */}
            <div className="progress-container">
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${((STEPS.indexOf(step) + 1) / STEPS.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* STEP 1: EMPLOYEE SEARCH */}
            {step === 'employee' && (
                <div style={{ padding: 'var(--space-md)' }}>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                        Busca por Nombre o Número de Identificación (Cédula) al colaborador responsable.
                    </p>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="🔍 Nombre o ID..."
                        value={searchEmployee}
                        onChange={(e) => setSearchEmployee(e.target.value)}
                        style={{ marginBottom: 'var(--space-md)', padding: '12px', fontSize: '1rem' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {filteredEmployees.map(emp => (
                            <div
                                key={emp.id}
                                className="card"
                                style={{ padding: 'var(--space-md)', cursor: 'pointer', border: '1px solid transparent', transition: '0.2s' }}
                                onClick={() => handleEmployeeSelect(emp)}
                            >
                                <div style={{ fontWeight: 'bold' }}>{emp.name}</div>
                                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                    Cédula: {emp.employee_id} • Depto: {emp.department}
                                </div>
                            </div>
                        ))}
                        {filteredEmployees.length === 0 && searchEmployee.trim() !== '' && (
                            <div className="empty-state">
                                <div className="empty-icon">❌</div>
                                <p>No se encontraron colaboradores</p>
                            </div>
                        )}
                        {filteredEmployees.length === 0 && searchEmployee.trim() === '' && employees.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-icon">👥</div>
                                <p>No hay empleados registrados</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* STEP 2: SCAN MULTIPLE BARCODES */}
            {step === 'scan' && (
                <div className="scanner-container">
                    <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <strong>A cargo de:</strong> {selectedEmployee.name}
                    </div>

                    <div style={{ padding: 'var(--space-md)' }}>
                        <div id="scanner-container" style={{
                            width: '100%',
                            height: '300px',
                            background: '#000',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            {!isScanning && <div style={{ color: '#fff', textAlign: 'center', paddingTop: '100px' }}>Iniciando cámara...</div>}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '10%',
                                right: '10%',
                                height: '2px',
                                background: 'rgba(232, 185, 74, 0.7)',
                                boxShadow: '0 0 10px rgba(232, 185, 74, 1)',
                                zIndex: 10
                            }} />
                        </div>
                    </div>

                    <div style={{ padding: '0 var(--space-md)' }}>
                        <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="🔍 O ingrese código manual"
                                value={manualCode}
                                onChange={e => setManualCode(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                            />
                            <button className="btn btn-secondary" onClick={handleManualSearch}>Buscar</button>
                        </div>
                    </div>

                    {/* SCANNED ITEMS LIST COMPACT */}
                    {scannedProducts.length > 0 && (
                        <div style={{ padding: '0 var(--space-md)', marginBottom: 'var(--space-md)' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                                Últimos escaneados ({scannedProducts.length} items):
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                {scannedProducts.map(item => (
                                    <div key={item.product.id} className="card" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)' }}>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.product.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{item.product.code}</div>
                                        </div>
                                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-accent)', marginLeft: '10px' }}>
                                            x{item.quantity}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ padding: 'var(--space-md)', textAlign: 'center', marginTop: 'auto' }}>
                        <button
                            className="btn btn-primary"
                            style={{ padding: '15px 30px', fontSize: '1.2rem', width: '100%' }}
                            onClick={() => {
                                if (scannedProducts.length === 0) {
                                    addToast('Debe escanear al menos un producto', 'warning');
                                    return;
                                }
                                setStep('review');
                            }}
                        >
                            📋 Revisar {scannedProducts.reduce((acc, item) => acc + item.quantity, 0)} items y Continuar
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3: REVIEW */}
            {step === 'review' && (
                <div style={{ padding: 'var(--space-md)' }}>
                    <div style={{ padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-md)' }}>
                        <strong>Responsable:</strong> {selectedEmployee.name} <br />
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Cédula: {selectedEmployee.employee_id}</span>
                    </div>

                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>Equipos a asignar:</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight: '50vh', overflowY: 'auto', marginBottom: 'var(--space-md)' }}>
                        {scannedProducts.map(item => (
                            <div key={item.product.id} className="card" style={{ padding: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold' }}>{item.product.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{item.product.code}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Stock actual: {item.product.quantity}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                            <button
                                                style={{ background: 'none', border: 'none', padding: '8px 12px', fontSize: '1rem', cursor: 'pointer', color: 'var(--color-text)' }}
                                                onClick={() => updateQuantity(item.product.id, -1)}
                                            >-</button>
                                            <div style={{ padding: '0 8px', fontWeight: 'bold' }}>{item.quantity}</div>
                                            <button
                                                style={{ background: 'none', border: 'none', padding: '8px 12px', fontSize: '1rem', cursor: 'pointer', color: 'var(--color-text)' }}
                                                onClick={() => updateQuantity(item.product.id, 1)}
                                            >+</button>
                                        </div>
                                        <button
                                            className="btn btn-icon btn-danger"
                                            onClick={() => removeProduct(item.product.id)}
                                        >🗑️</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('scan')}>➕ Más</button>
                        <button
                            className="btn btn-primary"
                            style={{ flex: 2 }}
                            onClick={() => {
                                if (scannedProducts.length === 0) {
                                    addToast('No hay productos para asignar', 'warning');
                                    return;
                                }
                                setStep('signature');
                            }}
                        >
                            ✍️ Pasar a Firma
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 4: SIGNATURE */}
            {step === 'signature' && (
                <div style={{ padding: 'var(--space-md)' }}>
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>Firma del Colaborador</div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            Yo, <strong>{selectedEmployee.name}</strong>, acepto la asignación de {scannedProducts.reduce((a, b) => a + b.quantity, 0)} equipo(s) y asumo responsabilidad por su buen uso.
                        </p>
                    </div>

                    <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <SignaturePadComponent ref={signatureRef} />
                        <div style={{ textAlign: 'right', marginTop: 'var(--space-sm)' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => signatureRef.current?.clear()}>
                                Borrar firma
                            </button>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', fontWeight: 600 }}
                        onClick={handleFinalize}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Procesando...' : '✅ Comprometer Asignación'}
                    </button>
                </div>
            )}

            {/* STEP 5: COMPLETE */}
            {step === 'complete' && deliveryResult && (
                <div style={{ padding: 'var(--space-xl) var(--space-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>✅</div>
                    <h2 style={{ marginBottom: 'var(--space-md)' }}>Asignación Exitosa</h2>

                    <div className="card" style={{ textAlign: 'left', marginBottom: 'var(--space-lg)' }}>
                        <p><strong>A cargo de:</strong> {selectedEmployee.name}</p>
                        <p><strong>Equipos Total:</strong> {scannedProducts.reduce((a, b) => a + b.quantity, 0)} unidades</p>
                        <p><strong>Estado:</strong> Activo (En uso)</p>
                    </div>

                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-xl)' }}>
                        El PDF de entrega múltiple se ha descargado automáticamente. Los equipos ya figuran en la hoja de vida de equipos asignados al colaborador.
                    </p>

                    <button className="btn btn-primary" onClick={resetScanner} style={{ width: '100%', padding: '1rem' }}>
                        Volver al inicio
                    </button>
                </div>
            )}
        </div>
    );
}
