import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-2xl">⚠️</p>
          <h2 className="text-lg font-bold text-carbon-900">Algo salió mal</h2>
          <p className="text-sm text-carbon-500">Recarga la página o intenta más tarde.</p>
          <button onClick={() => window.location.reload()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Recargar</button>
        </div>
      )
    }
    return this.props.children
  }
}
