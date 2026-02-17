/**
 * Error Boundary — Catches React render errors gracefully
 *
 * Instead of a blank screen, shows an error message with
 * retry button and diagnostic information.
 */

import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: string;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: '' };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        this.setState({
            errorInfo: errorInfo.componentStack ?? '',
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: '#1a0a0a',
                    color: '#ff5555',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '10px',
                    padding: 40,
                    zIndex: 10000,
                }}>
                    <div style={{ fontSize: 48, marginBottom: 20 }}>💥</div>
                    <h1 style={{ marginBottom: 10, color: '#ff3333' }}>Minecraft R3F — Crash!</h1>
                    <p style={{ color: '#ffaa00', marginBottom: 20 }}>
                        Wystąpił błąd w renderowaniu gry.
                    </p>
                    <div style={{
                        background: 'rgba(255,0,0,0.1)',
                        border: '1px solid #ff3333',
                        padding: 15,
                        borderRadius: 4,
                        maxWidth: 600,
                        maxHeight: 200,
                        overflow: 'auto',
                        marginBottom: 20,
                        width: '100%',
                        fontSize: 8,
                        color: '#ff8888',
                    }}>
                        <strong>Error:</strong> {this.state.error?.message}
                        <br /><br />
                        <strong>Stack:</strong>
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {this.state.error?.stack?.slice(0, 500)}
                        </pre>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null, errorInfo: '' });
                            }}
                            style={{
                                background: '#4a2', color: '#fff', border: 'none',
                                padding: '10px 24px', fontFamily: 'inherit', fontSize: 10,
                                cursor: 'pointer',
                            }}
                        >
                            🔄 Spróbuj ponownie
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: '#a42', color: '#fff', border: 'none',
                                padding: '10px 24px', fontFamily: 'inherit', fontSize: 10,
                                cursor: 'pointer',
                            }}
                        >
                            ♻ Odśwież stronę
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
