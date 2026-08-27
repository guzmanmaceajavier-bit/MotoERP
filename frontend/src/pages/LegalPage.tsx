import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const DEFAULT_PRIVACY = [
  {
    h: '1. Responsable del tratamiento',
    p: 'MotoHouse, taller de motocicletas, es responsable del tratamiento de los datos personales recopilados a través de esta plataforma. Para consultas sobre privacidad, contáctanos al correo electrónico informacion@motohouse.com o al número de WhatsApp disponible en la sección de contacto.',
  },
  {
    h: '2. Datos que recopilamos',
    p: 'Recopilamos los siguientes datos personales cuando creas una cuenta, agendes una cita, realizas una compra o contactas con nosotros: nombre completo, correo electrónico, número de teléfono, marca y modelo de tu motocicleta, placa (si la proporcionas), y dirección de envío (solo para pedidos con domicilio). También recopilamos datos de navegación como dirección IP, tipo de navegador y páginas visitadas, de forma automática.',
  },
  {
    h: '3. Finalidad del tratamiento',
    p: 'Tus datos se utilizan exclusivamente para: gestionar citas de servicio, procesar órdenes de compra y repuestos, enviar notificaciones sobre el estado de tu moto (por WhatsApp o correo), gestionar facturación y garantías, y mejorar la experiencia de uso de la plataforma. No utilizamos tus datos para fines distintos a los aquí descritos.',
  },
  {
    h: '4. Base legal',
    p: 'El tratamiento de tus datos se realiza bajo tu consentimiento explícito (al crear tu cuenta o agendar una cita), la ejecución de un contrato (prestación de servicios o venta de repuestos), y el cumplimiento de obligaciones legales en materia tributaria y contable.',
  },
  {
    h: '5. Compartición de datos',
    p: 'No vendemos ni compartimos tus datos personales con terceros para fines de marketing. Únicamente compartimos información con: proveedores de servicios de mensajería (para envíos), plataformas de pago (para procesar transacciones), y autoridades competentes cuando exista una obligación legal.',
  },
  {
    h: '6. Conservación de datos',
    p: 'Tus datos se conservan mientras tu cuenta esté activa. Si eliminas tu cuenta, tus datos personales se eliminarán o anonimizarán en un plazo máximo de 30 días, excepto aquellos que debamos conservar por obligación legal (facturas, registros contables por 5 años).',
  },
  {
    h: '7. Tus derechos',
    p: 'Tienes derecho a: acceder a tus datos personales, solicitar su rectificación o eliminación, oponerte al tratamiento, solicitar la portabilidad de tus datos, y retirar tu consentimiento en cualquier momento. Para ejercer estos derechos, contáctanos al correo informacion@motohouse.com.',
  },
  {
    h: '8. Seguridad',
    p: 'Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos: contraseñas cifradas con bcrypt, conexiones HTTPS, control de acceso por roles, y auditoría de acciones sensibles. Sin embargo, ningún sistema es 100% seguro, por lo que te recomendamos usar contraseñas fuertes y no compartir tu cuenta.',
  },
  {
    h: '9. Cookies',
    p: 'Utilizamos cookies estrictamente necesarias para el funcionamiento de la plataforma (sesión de usuario, preferencias). No utilizamos cookies de rastreo publicitario. Puedes gestionar las cookies desde la configuración de tu navegador.',
  },
  {
    h: '10. Cambios en esta política',
    p: 'Nos reservamos el derecho de actualizar esta política de privacidad. Los cambios serán publicados en esta página con la fecha de última actualización. Te recomendamos revisarla periódicamente.',
  },
]

const DEFAULT_TERMS = [
  {
    h: '1. Aceptación de los términos',
    p: 'Al acceder y usar esta plataforma, aceptas estos términos y condiciones en su totalidad. Si no estás de acuerdo con alguno de los términos, no debes usar el servicio.',
  },
  {
    h: '2. Descripción del servicio',
    p: 'MotoHouse ofrece una plataforma para agendar servicios de mantenimiento y reparación de motocicletas, comprar repuestos y accesorios, y gestionar órdenes de servicio. El servicio incluye acceso a un panel personal, seguimiento de órdenes, y sistema de notificaciones.',
  },
  {
    h: '3. Cuenta de usuario',
    p: 'Eres responsable de mantener la confidencialidad de tu contraseña y de todas las actividades que ocurran bajo tu cuenta. Debes notificarnos inmediatamente si detectas uso no autorizado. Nos reservamos el derecho de suspender cuentas que violen estos términos.',
  },
  {
    h: '4. Servicios de taller',
    p: 'Los servicios se realizan conforme a la cotización aprobada por el cliente. El taller se compromete a ejecutar los trabajos con la calidad y tiempos acordados. Los repuestos instalados tienen garantía según las condiciones del fabricante y lo indicado en la orden de servicio.',
  },
  {
    h: '5. Pagos y facturación',
    p: 'Los precios incluyen los impuestos vigentes. El pago puede realizarse en efectivo, transferencia bancaria o tarjeta, según las opciones disponibles. Las facturas se emiten electrónicamente y están disponibles en tu panel de usuario.',
  },
  {
    h: '6. Política de envíos',
    p: 'Los envíos de repuestos se realizan a la dirección indicada en el pedido. Los tiempos de entrega son estimados y pueden variar según la ubicación y disponibilidad del producto. El costo de envío se calcula al momento de la compra.',
  },
  {
    h: '7. Devoluciones y garantías',
    p: 'Los repuestos en su empaque original pueden devolverse dentro de los 7 días posteriores a la recepción, siempre que no estén dañados ni instalados. Los trabajos de taller tienen garantía según lo indicado en la orden de servicio. Para reclamos, contáctanos a través de los canales oficiales.',
  },
  {
    h: '8. Responsabilidades',
    p: 'El taller no se responsabiliza por accesorios o pertenencias personales no reportadas al ingreso de la motocicleta. El cliente debe revisar y aprobar el estado de su moto al momento del retiro. La plataforma no se hace responsable por daños derivados del uso indebido de los repuestos adquiridos.',
  },
  {
    h: '9. Propiedad intelectual',
    p: 'Todo el contenido de la plataforma (diseños, logotipos, textos, código fuente) es propiedad de MotoHouse o sus licenciantes. Queda prohibida su reproducción total o parcial sin autorización escrita.',
  },
  {
    h: '10. Modificaciones',
    p: 'Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones serán efectivas desde su publicación en esta página. El uso continuado de la plataforma después de los cambios constituye tu aceptación de los nuevos términos.',
  },
]

function parseContent(raw: string): { h: string; p: string }[] {
  if (!raw.trim()) return []
  const blocks = raw.trim().split(/\n\s*\n/)
  const out: { h: string; p: string }[] = []
  let current: { h: string; p: string[] } | null = null
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const first = lines[0]
    if (first.startsWith('#')) {
      if (current) out.push({ h: current.h, p: current.p.join(' ') })
      current = { h: first.replace(/^#+\s*/, ''), p: [] }
    } else if (current) {
      current.p.push(lines.join(' '))
    } else {
      out.push({ h: 'Información', p: lines.join(' ') })
    }
  }
  if (current) out.push({ h: current.h, p: current.p.join(' ') })
  return out
}

export default function LegalPage({ title }: { title: string }) {
  const isPrivacy = title === 'Política de privacidad'
  const [custom, setCustom] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ privacy_content: string; terms_content: string }>('/site-info')
      .then((d) => {
        if (alive) setCustom(isPrivacy ? d.privacy_content : d.terms_content)
      })
      .catch(() => {
        if (alive) setCustom('')
      })
    return () => { alive = false }
  }, [isPrivacy])

  const sections = custom !== null && custom.trim() ? parseContent(custom) : (isPrivacy ? DEFAULT_PRIVACY : DEFAULT_TERMS)

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-carbon-900 dark:text-carbon-700">{title}</h1>
      <p className="mt-1 text-sm text-carbon-500">Última actualización: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
      {custom === null ? (
        <div className="mt-8 space-y-6">
          {(isPrivacy ? DEFAULT_PRIVACY : DEFAULT_TERMS).map((s) => (
            <div key={s.h}>
              <h2 className="font-semibold text-carbon-900">{s.h}</h2>
              <p className="mt-1 text-sm leading-relaxed text-carbon-600">{s.p}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {sections.map((s, idx) => (
            <div key={`${s.h}-${idx}`}>
              <h2 className="font-semibold text-carbon-900 dark:text-carbon-700">{s.h}</h2>
              <p className="mt-1 text-sm leading-relaxed text-carbon-600 dark:text-carbon-400">{s.p}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
