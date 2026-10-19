import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { hasError: boolean };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostics in the developer console; do not expose details in the UI.
    console.error("Application render failed", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center p-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Trang gặp sự cố</h1>
            <p className="mt-2 text-sm text-slate-600">Vui lòng tải lại trang để tiếp tục.</p>
            <button className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-white" onClick={() => window.location.reload()}>
              Tải lại trang
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
