import { useState } from 'react'
import { Link } from 'react-router-dom'
import CatalogSimple from '../../components/staff/CatalogSimple'
import { SectionHeader } from '../../components/ui'

type Tab = 'brands' | 'models'

export default function BrandsModels() {
  const [tab, setTab] = useState<Tab>('brands')
  const [modelsBrandFilter, setModelsBrandFilter] = useState('')

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Marcas y Modelos"
        subtitle="Fabricantes de motocicletas y sus modelos, para órdenes y catálogo."
        variant="brand"
        action={
          <Link to="/admin/inventario" className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
            Ver inventario →
          </Link>
        }
      />
      <div className="mb-4 inline-flex gap-1 rounded-xl border border-brand-300 bg-white p-1">
        {(
          [
            { id: 'brands', label: 'Marcas' },
            { id: 'models', label: 'Modelos' },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-brand-600 text-white' : 'text-carbon-600 hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'brands' ? (
        <CatalogSimple
          key="brands"
          kind="brands"
          onViewModels={(id) => {
            setModelsBrandFilter(String(id))
            setTab('models')
          }}
        />
      ) : (
        <CatalogSimple key="models" kind="models" initialBrandFilter={modelsBrandFilter} />
      )}
    </div>
  )
}