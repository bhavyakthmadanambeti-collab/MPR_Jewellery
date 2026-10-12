```tsx
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('MPR Jewellery UI error:', error);
    console.error('Component stack:', info.componentStack);
  }

  retryCurrentPage = () => {
    // Reload the current URL without redirecting to Home.
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <h1 className="text-[30px]">
            Something went wrong
          </h1>

          <p className="mt-2 text-cocoa-100">
            This page could not be displayed.
            Please try again or choose another page.
          </p>

          <button
            className="btn-primary mt-6"
            onClick={this.retryCurrentPage}
          >
            Retry this page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```
