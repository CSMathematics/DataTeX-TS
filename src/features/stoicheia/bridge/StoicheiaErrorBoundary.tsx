import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onBack: () => void;
}
interface State {
  error: Error | null;
}

export class StoicheiaErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DataTeX][Stoicheia] isolated render error", error, info);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section
        role="alert"
        className="theme-app flex h-full min-h-0 w-full items-center justify-center p-6"
      >
        <div className="theme-panel w-full max-w-xl rounded-2xl border p-6 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">
            Graphics Studio
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            The graphics workbench stopped safely
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            DataTeX is still running. Retry the isolated workbench or return to
            Package Studio.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-black/20 p-3 text-xs text-rose-300">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={this.props.onBack}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={this.retry}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }
}
