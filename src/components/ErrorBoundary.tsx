import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'Ocorreu um erro inesperado.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed?.error) {
        readable = `Erro de permissão ou conexão (${parsed.operationType || 'operação'}): ${parsed.error}`;
      }
    } catch {
      // Keep raw message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ORCA ErrorBoundary:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#06070B] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl bg-[#0E1117] border border-white/10 p-7 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">
                Algo saiu do previsto
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed break-words">
                {this.state.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="w-full py-3 px-5 rounded-xl orca-gradient-btn text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar ORCA
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
