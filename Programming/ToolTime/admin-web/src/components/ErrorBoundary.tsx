import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

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
    console.error('Uncaught error in Burk Haustechnik Cockpit:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">
                Burk Haustechnik Cockpit
              </h2>
              <p className="text-sm text-slate-300">
                Die Anwendung konnte vorübergehend nicht geladen werden.
              </p>
              {this.state.error?.message && (
                <div className="bg-slate-900/80 p-3 rounded-lg text-left text-xs font-mono text-red-300 border border-slate-700 overflow-x-auto max-h-32">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Cockpit neu laden</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
