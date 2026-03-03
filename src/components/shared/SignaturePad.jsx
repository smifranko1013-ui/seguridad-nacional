import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import SignaturePadLib from 'signature_pad';

const SignaturePadComponent = forwardRef(({ onEnd, width, height = 200 }, ref) => {
    const canvasRef = useRef(null);
    const padRef = useRef(null);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeCanvas = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = (height || 200) * ratio;
            canvas.style.height = `${height || 200}px`;
            canvas.getContext('2d').scale(ratio, ratio);
            if (padRef.current) padRef.current.clear();
        };

        padRef.current = new SignaturePadLib(canvas, {
            backgroundColor: 'rgba(255, 255, 255, 0)',
            penColor: '#c9a84c',
            minWidth: 1.5,
            maxWidth: 3,
            throttle: 16,
        });

        padRef.current.addEventListener('endStroke', () => {
            setIsEmpty(padRef.current.isEmpty());
            if (onEnd) onEnd(padRef.current.toDataURL());
        });

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (padRef.current) padRef.current.off();
        };
    }, [height, onEnd]);

    useImperativeHandle(ref, () => ({
        clear: () => {
            if (padRef.current) {
                padRef.current.clear();
                setIsEmpty(true);
            }
        },
        toDataURL: () => padRef.current ? padRef.current.toDataURL() : '',
        isEmpty: () => padRef.current ? padRef.current.isEmpty() : true,
    }));

    return (
        <div className="signature-area">
            <canvas ref={canvasRef} style={{ width: '100%' }} />
            {isEmpty && (
                <div className="placeholder">✍️ Firme aquí</div>
            )}
        </div>
    );
});

SignaturePadComponent.displayName = 'SignaturePad';
export default SignaturePadComponent;
