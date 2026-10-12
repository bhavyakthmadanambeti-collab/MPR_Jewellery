import { Component, type ReactNode } from 'react';

interface Props {
children: ReactNode;
}

interface State {
error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
state: State = { error: null };

static getDerivedStateFromError(error: Error): State {
return { error };
}

componentDidCatch(error: Error, info: React.ErrorInfo) {
console.error('MPR Jewellery UI error:', error);
console.error('Component stack:', info.componentStack);
}

goHome = () => {
this.setState({ error: null });
window.location.hash = '/';
};

render() {
if (this.state.error) {
return ( <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"> <h1 className="text-[30px]">Page error</h1>

```
      <p className="mt-2 text-cocoa-100">
        You can return to the Home page.
      </p>

      <button
        className="btn-primary mt-6"
        onClick={this.goHome}
      >
        Go to Home
      </button>
    </div>
  );
}

return this.props.children;
```

}
}
