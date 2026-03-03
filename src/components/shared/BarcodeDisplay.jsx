import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function BarcodeDisplay({ value, width = 2, height = 50, fontSize = 14, displayValue = true }) {
    const svgRef = useRef(null);

    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: 'CODE128',
                    width,
                    height,
                    fontSize,
                    displayValue,
                    background: '#ffffff',
                    lineColor: '#0a1628',
                    margin: 8,
                    font: 'Inter'
                });
            } catch (err) {
                console.error('Error generating barcode:', err);
            }
        }
    }, [value, width, height, fontSize, displayValue]);

    if (!value) return null;

    return (
        <div className="barcode-container">
            <svg ref={svgRef} />
        </div>
    );
}
