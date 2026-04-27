import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>出现了一些问题</h1>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>
            应用程序遇到了错误，请尝试重新加载
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.75rem 2rem',
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
            }}
          >
            重新加载
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: '2rem',
              padding: '1rem',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              maxWidth: '600px',
              overflow: 'auto',
              fontSize: '0.75rem',
              textAlign: 'left',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for components to handle errors gracefully
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((err: Error) => {
    console.error('[useErrorHandler]', err);
    setError(err);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  if (error) {
    throw error; // Re-throw to ErrorBoundary
  }

  return { handleError, clearError };
}