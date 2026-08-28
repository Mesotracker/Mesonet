import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0c0e12] text-slate-100 flex items-center justify-center p-6 font-mono selection:bg-orange-500 selection:text-black">
          <div className="max-w-2xl w-full bg-[#141820] border border-red-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white uppercase tracking-wider">
                  MesoMax RiskSim · Simulation Exception Caught
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  An error occurred while evaluating atmospheric levels or rendering visualizer canvases.
                </p>
              </div>
            </div>

            <div className="bg-black/60 border border-slate-800 rounded-xl p-4 text-xs font-mono text-red-300 overflow-x-auto max-h-64">
              <div className="font-bold text-red-400 mb-1">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              {this.state.error?.stack && (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold uppercase rounded-lg transition flex items-center gap-2 shadow-lg shadow-orange-600/30"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch (e) {
                    // ignore
                  }
                  window.location.href = window.location.pathname;
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase rounded-lg transition flex items-center gap-2 border border-slate-700"
              >
                <Home className="w-4 h-4" />
                Clear Cache & Restart
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
