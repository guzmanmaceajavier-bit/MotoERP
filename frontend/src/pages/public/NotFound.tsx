import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="relative isolate overflow-hidden bg-carbon-950 py-24 text-white">
      <div className="absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_20%_20%,rgba(229,57,53,0.25)_0,transparent_50%),radial-gradient(circle_at_85%_80%,rgba(239,68,68,0.15)_0,transparent_45%)]" />
      <div className="absolute inset-0 -z-10 dot-grid opacity-15" />
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 text-center">
        <p className="text-8xl font-black leading-none gradient-text">404</p>
        <h1 className="mt-4 text-3xl font-black md:text-4xl">Página no encontrada</h1>
        <p className="mt-3 max-w-md text-carbon-300">
          La página que buscas no existe o fue movida. Vuelve al inicio o explora nuestros servicios.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary btn-shine">
            Ir al inicio
          </Link>
          <Link to="/tienda" className="glass text-white hover:bg-white/15">
            Ver tienda
          </Link>
        </div>
      </div>
    </div>
  )
}