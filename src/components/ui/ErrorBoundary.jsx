import * as React from 'react';
import { debugEnabled } from '../../lib/debugStore';

/**
 * Catch render errors and present a minimal, mobile-safe fallback UI.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: `ERR-${Date.now()}`,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (debugEnabled()) {
      console.error('[ErrorBoundary] render crash', error, errorInfo);
    }
    this.props.onError?.(error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return <React.Fragment>{this.props.children}</React.Fragment>;
    }

    const showDetails = this.props.showDetails ?? debugEnabled();
    const diagnostic = this.state.errorId ?? 'ERR-UNKNOWN';
    const errorMessage = this.state.error?.message ?? 'Unexpected render failure';

    return (
      <div
        className="flex min-h-screen w-full flex-col gap-4 bg-slate-950 px-4 py-8 text-slate-100"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold">Pocket Court hit a snag.</p>
          <p className="text-sm text-slate-300">
            The screen could not finish rendering. Please reload to continue.
          </p>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Diagnostic: {diagnostic}
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm hover:border-slate-500 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          Reload
        </button>
        {showDetails && (
          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
            <p className="font-semibold text-slate-300">Error details</p>
            <p className="mt-1 break-words">{errorMessage}</p>
            {this.state.errorInfo?.componentStack && (
              <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-snug text-slate-400">
                {this.state.errorInfo.componentStack.trim()}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
