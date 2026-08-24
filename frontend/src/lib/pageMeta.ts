import type { BreadcrumbItem } from '../components/PageBreadcrumb'

/**
 * Nombre del último producto visto, para mostrarlo en el breadcrumb
 * (ej. Inicio › Tienda › Aceite sintético 10W-40).
 */
let lastProductName = ''
export function setLastProductName(name: string) {
  lastProductName = name
}

/**
 * Etiquetas de página para el breadcrumb público (sitio web).
 * El orden de p.búsqueda importa: rutas más específicas primero.
 */
const PUBLIC_PAGES: { match: RegExp; crumbs: (m: RegExpMatchArray) => BreadcrumbItem[] }[] = [
  {
    match: /^\/tienda\/(.+)$/,
    crumbs: () => [{ label: 'Tienda', to: '/tienda' }, { label: lastProductName || 'Producto' }],
  },
  {
    match: /^\/tienda$/,
    crumbs: () => [{ label: 'Tienda' }],
  },
  {
    match: /^\/agendar$/,
    crumbs: () => [{ label: 'Servicios', to: '/servicios' }, { label: 'Agendar cita' }],
  },
  {
    match: /^\/consultar$/,
    crumbs: () => [{ label: 'Consultar compra' }],
  },
  {
    match: /^\/lista\//,
    crumbs: () => [{ label: 'Lista compartida' }],
  },
  {
    match: /^\/registro$/,
    crumbs: () => [{ label: 'Crear cuenta' }],
  },
  {
    match: /^\/login$/,
    crumbs: () => [{ label: 'Iniciar sesión' }],
  },
  {
    match: /^\/servicios$/,
    crumbs: () => [{ label: 'Servicios' }],
  },
  {
    match: /^\/blog$/,
    crumbs: () => [{ label: 'Blog' }],
  },
  {
    match: /^\/nosotros$/,
    crumbs: () => [{ label: 'Nosotros' }],
  },
  {
    match: /^\/contacto$/,
    crumbs: () => [{ label: 'Contacto' }],
  },
  {
    match: /.*/,
    crumbs: () => [{ label: 'Inicio' }],
  },
]

export function publicBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const match = PUBLIC_PAGES.find((p) => p.match.test(pathname))
  return match ? match.crumbs(pathname.match(match.match)!) : [{ label: 'Inicio' }]
}