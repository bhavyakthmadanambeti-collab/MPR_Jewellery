import { Component, type ReactNode } from 'react';

/** Prevents a single rendering error from blanking the whole site. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('UI error:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-[30px]">Something went wrong</h1>
        <p className="mt-2 text-cocoa-100">Please reload the page. If this keeps happening, contact us.</p>
        <button className="btn-primary mt-6" onClick={() => { this.setState({ error: null }); window.location.reload(); }}>Reload page</button>
      </div>
    );
  }
}
