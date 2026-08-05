import { Component } from 'react';

// html5-qrcode runs its own internal setTimeout-driven scan loop
// (foreverScan) that keeps re-entering after stop() in some race
// conditions and can throw synchronously from deep inside a promise chain
// tied to this component's lifecycle. A crash there has nothing to do with
// the rest of the permit-open flow, so it's caught here and degraded to the
// manual-entry fallback instead of blanking the whole screen.
export default class ScannerErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[QR scanner] recovered from a scanner error:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
