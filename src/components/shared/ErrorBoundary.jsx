import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '20px',
                    background: '#ffebee',
                    color: '#c62828',
                    minHeight: '100vh',
                    width: '100%',
                    boxSizing: 'border-box',
                    overflowY: 'auto'
                }}>
                    <h2 style={{ marginTop: 0 }}>💥 Algo salió mal en tu celular</h2>
                    <p>Por favor toma una captura de pantalla de este error y compártela para solucionarlo:</p>
                    <div style={{
                        background: '#ffffff',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #ffcdd2',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: '0.85rem'
                    }}>
                        <strong>Error:</strong><br />
                        {this.state.error && this.state.error.toString()}
                        <br /><br />
                        <strong>Component Trace:</strong><br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </div>
                    <button
                        style={{
                            marginTop: '20px',
                            padding: '15px',
                            background: '#c62828',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            width: '100%',
                            fontSize: '1rem',
                            fontWeight: 'bold'
                        }}
                        onClick={() => window.location.reload()}
                    >
                        🔄 Recargar Aplicación
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
