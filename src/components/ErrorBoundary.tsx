import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error?: Error; resetError: () => void }> = ({
  error,
  resetError,
}) => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
    <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mb-6">
      <AlertTriangle className="h-10 w-10 text-destructive" />
    </div>
    <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
    <p className="text-sm text-muted-foreground mb-4 max-w-xs">
      We encountered an unexpected error. Please try refreshing the page.
    </p>
    {error && (
      <details className="mb-6 max-w-md">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          Error details
        </summary>
        <pre className="text-xs bg-secondary p-3 rounded-lg mt-2 overflow-auto max-h-32">
          {error.message}
        </pre>
      </details>
    )}
    <div className="flex gap-3">
      <Button onClick={resetError} variant="outline" className="rounded-full">
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
      <Button onClick={() => window.location.reload()} className="rounded-full gradient-primary text-primary-foreground">
        Refresh Page
      </Button>
    </div>
  </div>
);

export default ErrorBoundary;