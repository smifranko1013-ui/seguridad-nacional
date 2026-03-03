import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import SignaturePadLib from 'signature_pad';

const SignaturePadComponent = forwardRef(({ onEnd, width, height = 200 }, ref) => {
    const canvasRef = useRef(null);
    const padRef = useRef(null);
    const [isEmpty, setIsEmpty] = useState(true);

    const latestOnEnd = useRef(onEnd);

    useEffect(() => {
        latestOnEnd.current = onEnd;
    }, [onEnd]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeCanvas = () => {
            if (!canvas) return;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            // Fallback width if offsetWidth is 0 during transitions
            const width = canvas.offsetWidth || canvas.parentElement?.offsetWidth || window.innerWidth - 64;
            canvas.width = width * ratio;
            canvas.height = (height || 200) * ratio;
            canvas.style.width = '100%';
            canvas.style.height = `${height || 200}px`;
            canvas.getContext('2d').scale(ratio, ratio);
            if (padRef.current) {
                padRef.current.clear();
            }
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
            if (latestOnEnd.current) latestOnEnd.current(padRef.current.toDataURL());
        });

        // Delay initial resize to ensure DOM is fully painted with proper dimensions
        setTimeout(resizeCanvas, 50);
        window.addEventListener('resize', resizeCanvas);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (padRef.current) padRef.current.off();
        };
    }, [height]); // Removed onEnd to prevent canvas crashing from re-renders

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
        <div className="signature-area" style={{ background: '#ffffff', border: '2px solid rgba(232, 185, 74, 0.4)', borderRadius: 'var(--radius-lg)' }}>
            <canvas ref={canvasRef} style={{ width: '100%', touchAction: 'none' }} />
            {isEmpty && (
                <div className="placeholder" style={{ color: '#666' }}>✍️ Firme aquí</div>
            )}
        </div>
    );
});

SignaturePadComponent.displayName = 'SignaturePad';
export default SignaturePadComponent;
