import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props> {
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('MPR Jewellery UI error:', error);
    console.error('Component stack:', info.componentStack);
  }

  render() {
    return this.props.children;
  }
}
