"use client";

import React, { Component, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches React rendering errors and displays a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error caught by boundary:", error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md w-full">
            <div className="rounded-lg border border-red-500/60 bg-red-500/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-red-100 mb-2">
                    Something went wrong
                  </h2>
                  <p className="text-sm text-red-200/80 mb-4">
                    An unexpected error occurred. Please try refreshing the page.
                  </p>
                  {process.env.NODE_ENV === "development" && this.state.error && (
                    <details className="mt-4">
                      <summary className="text-xs text-red-300 cursor-pointer hover:text-red-200 mb-2">
                        Error details (development only)
                      </summary>
                      <pre className="text-xs text-red-200 bg-red-950/50 rounded p-3 overflow-auto max-h-48">
                        {this.state.error.toString()}
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Smaller error boundary for component-level errors
 * Shows inline error message instead of full-page error
 */
export function InlineErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Component Error
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                This component failed to render. Please try refreshing the page.
              </p>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
