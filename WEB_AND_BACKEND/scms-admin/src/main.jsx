import './index.css'
import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// ✅ Error boundary to catch and display React render errors visibly
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('🔴 React Render Error:', error);
    console.error('Component Stack:', info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#0f172a', color: 'white', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '40px', fontFamily: 'monospace'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔴</div>
          <h1 style={{ color: '#f87171', fontSize: 24, marginBottom: 12 }}>App Crashed</h1>
          <pre style={{
            background: '#1e293b', padding: 20, borderRadius: 12, maxWidth: 800,
            overflowX: 'auto', fontSize: 13, color: '#94a3b8', lineHeight: 1.6
          }}>
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: 24, padding: '12px 32px', background: '#3b82f6',
              color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

