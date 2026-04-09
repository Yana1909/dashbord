import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-[32px] border-2 border-dashed border-red-200 text-center">
          <h2 className="text-xl font-bold text-red-900 mb-2">Упс! Сталася помилка</h2>
          <p className="text-sm text-red-600 mb-4">{this.state.error?.message}</p>
          <button
            className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            Оновити сторінку
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
