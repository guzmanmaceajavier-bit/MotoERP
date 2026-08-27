import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useSiteInfo } from '../lib/useSiteImages'

const DEFAULT_PRIVACY = [
  {
    h: '1. Responsable del tratamiento',
    p: (name: string, email: string) =>
      `${name} es responsable del tratamiento de los datos personales recopilados a través de esta plataforma y de los servicios ofrecidos mediante ella.\n\nPara consultas, solicitudes o reclamos relacionados con el tratamiento de datos personales, puedes comunicarte a través de ${email} o mediante los canales de contacto disponibles en nuestra página web.`,
  },
  {
    h: '2. Datos que recopilamos',
    p: () => `Dependiendo de los servicios que utilices, podemos recopilar:\n\n• Nombre y apellidos.\n• Correo electrónico.\n• Número de teléfono.\n• Información de contacto.\n• Información de la motocicleta, como marca, modelo, placa y características que proporciones.\n• Información necesaria para gestionar citas y órdenes de servicio.\n• Dirección de envío cuando realices una compra con entrega a domicilio.\n• Información relacionada con compras, servicios, garantías y órdenes.\n• Información necesaria para procesar pagos, cuando corresponda.\n• Datos técnicos y de navegación, como dirección IP, tipo de dispositivo, navegador y páginas o funcionalidades utilizadas.\n\nSolo solicitaremos los datos que sean necesarios para las finalidades correspondientes.`,
  },
  {
    h: '3. Finalidades del tratamiento',
    p: () => `Los datos personales podrán ser utilizados para:\n\n• Crear y administrar tu cuenta.\n• Gestionar citas y servicios de mantenimiento o reparación.\n• Registrar y realizar seguimiento de órdenes de taller.\n• Procesar compras de repuestos y accesorios.\n• Gestionar entregas y direcciones de envío.\n• Procesar pagos a través de los proveedores correspondientes.\n• Enviar información relacionada con tus citas, compras, órdenes, garantías y servicios.\n• Contactarte cuando sea necesario para prestar el servicio solicitado.\n• Gestionar garantías, devoluciones y solicitudes de soporte.\n• Cumplir obligaciones legales, contables, tributarias y administrativas.\n• Mantener la seguridad de la plataforma y prevenir usos fraudulentos.\n• Mejorar el funcionamiento y la experiencia de usuario de la plataforma.\n\nNo utilizaremos los datos personales para finalidades incompatibles con aquellas informadas al usuario.`,
  },
  {
    h: '4. Autorización y base del tratamiento',
    p: () => `El tratamiento de datos personales se realizará de acuerdo con las normas aplicables en materia de protección de datos personales.\n\nCuando sea necesario, solicitaremos la autorización previa, expresa e informada del titular.\n\nTambién podremos tratar determinados datos cuando sea necesario para ejecutar una relación contractual, cumplir obligaciones legales o cuando exista otra base legal aplicable.`,
  },
  {
    h: '5. Compartición de información',
    p: (name: string) => `${name} no vende los datos personales de sus clientes.\n\nCuando sea necesario para prestar nuestros servicios, podremos compartir o permitir el acceso a determinada información con proveedores que actúen por nuestra cuenta, por ejemplo:\n\n• Proveedores de servicios tecnológicos y alojamiento.\n• Proveedores de mensajería y comunicaciones.\n• Plataformas de pago.\n• Proveedores logísticos y de transporte.\n• Proveedores necesarios para prestar servicios solicitados por el usuario.\n• Autoridades competentes cuando exista una obligación legal.\n\nEstos terceros deberán utilizar la información de acuerdo con las finalidades correspondientes y las obligaciones de protección de datos aplicables.\n\nCuando determinados proveedores procesen información desde otros países, ${name} adoptará las medidas que correspondan de acuerdo con la normativa aplicable.`,
  },
  {
    h: '6. Conservación de los datos',
    p: () => `Conservaremos los datos personales durante el tiempo necesario para cumplir las finalidades para las cuales fueron recopilados, atender obligaciones legales y contractuales, resolver posibles reclamaciones y cumplir los períodos de conservación exigidos por la normativa aplicable.\n\nCuando los datos ya no sean necesarios, serán eliminados, anonimizados o tratados de acuerdo con los procedimientos de conservación establecidos por el taller y las obligaciones legales correspondientes.`,
  },
  {
    h: '7. Derechos de los titulares',
    p: (name: string, email: string, phone: string) => `De acuerdo con la normativa aplicable, los titulares de los datos personales podrán:\n\n• Conocer, actualizar y rectificar sus datos personales.\n• Solicitar información sobre el uso de sus datos.\n• Solicitar la supresión de sus datos cuando sea procedente.\n• Solicitar la revocatoria de la autorización cuando corresponda.\n• Presentar consultas y reclamos relacionados con el tratamiento de sus datos.\n• Ejercer los demás derechos reconocidos por la normativa colombiana aplicable.\n\nPara ejercer estos derechos puedes comunicarte mediante:\n\nCorreo: ${email}\nWhatsApp: ${phone}\n\nLas solicitudes serán atendidas de acuerdo con los procedimientos y plazos establecidos por la normativa aplicable.`,
  },
  {
    h: '8. Seguridad',
    p: (name: string) => `${name} implementa medidas técnicas, administrativas y organizativas destinadas a proteger los datos personales frente a pérdida, acceso no autorizado, alteración, divulgación o uso indebido.\n\nEstas medidas incluyen controles de acceso, autenticación, conexiones seguras y mecanismos de protección de la información.\n\nA pesar de las medidas implementadas, ningún sistema conectado a Internet puede garantizar una seguridad absoluta.`,
  },
  {
    h: '9. Cookies',
    p: (name: string) => `${name} utiliza cookies y tecnologías similares necesarias para el funcionamiento de la plataforma, incluyendo aquellas relacionadas con la sesión, seguridad, carrito de compras y determinadas preferencias.\n\nCuando utilicemos cookies opcionales para analítica, personalización o finalidades similares, estas serán gestionadas de acuerdo con las preferencias del usuario y la normativa aplicable.\n\nPuedes consultar y modificar tus preferencias de cookies mediante el mecanismo disponible en la plataforma.`,
  },
  {
    h: '10. Cambios en esta política',
    p: (name: string) => `${name} podrá actualizar esta Política de Privacidad cuando sea necesario debido a cambios legales, técnicos, operativos o en los servicios ofrecidos.\n\nLa versión vigente estará disponible en esta página e indicará la fecha de su última actualización.`,
  },
]

const DEFAULT_TERMS = [
  {
    h: '1. Aceptación de los términos',
    p: (name: string) => `Al acceder, registrarte o utilizar la plataforma ${name}, aceptas estos Términos y Condiciones.\n\nSi no estás de acuerdo con alguno de ellos, debes abstenerte de utilizar los servicios de la plataforma.\n\nAlgunos servicios, productos, promociones o funcionalidades pueden estar sujetos a condiciones particulares adicionales, las cuales serán informadas al usuario cuando corresponda.`,
  },
  {
    h: '2. Descripción de la plataforma',
    p: (name: string) => `${name} ofrece una plataforma digital mediante la cual los usuarios pueden:\n\n• Consultar servicios de mantenimiento y reparación de motocicletas.\n• Solicitar y agendar citas.\n• Registrar información relacionada con su motocicleta.\n• Consultar y realizar seguimiento de órdenes de taller.\n• Comprar repuestos y accesorios.\n• Consultar el estado de sus compras.\n• Gestionar información relacionada con garantías y servicios.\n• Recibir notificaciones relacionadas con sus citas, compras y órdenes.\n\nLa disponibilidad de determinadas funcionalidades puede variar según el estado de la plataforma, ubicación, inventario, horarios y condiciones del servicio.`,
  },
  {
    h: '3. Registro y cuenta de usuario',
    p: (name: string) => `Para utilizar determinadas funcionalidades puede ser necesario crear una cuenta.\n\nEl usuario se compromete a proporcionar información verdadera, completa y actualizada.\n\nEl usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de tomar las medidas necesarias para evitar el acceso no autorizado a su cuenta.\n\nSi el usuario detecta un acceso no autorizado o considera que sus credenciales han sido comprometidas, deberá informar a ${name} lo antes posible.\n\n${name} podrá suspender o limitar una cuenta cuando existan razones relacionadas con seguridad, fraude, uso indebido de la plataforma o incumplimiento de estos términos, respetando los derechos que correspondan al usuario.`,
  },
  {
    h: '4. Agenda y servicios de taller',
    p: () => `Las citas solicitadas mediante la plataforma estarán sujetas a la disponibilidad de horarios del taller.\n\nLa solicitud de una cita no implica necesariamente que el servicio haya sido confirmado. La confirmación se realizará mediante los mecanismos establecidos.\n\nEl diagnóstico, inspección o revisión de la motocicleta puede revelar problemas adicionales que no hayan sido identificados inicialmente.\n\nCuando se requieran trabajos adicionales, cambios de repuestos o costos diferentes a los inicialmente previstos, estos serán informados al cliente y se solicitará su aprobación cuando corresponda antes de realizar dichos trabajos.\n\nLos tiempos estimados de reparación pueden variar debido a la complejidad del trabajo, disponibilidad de repuestos, diagnósticos adicionales, circunstancias técnicas u otras situaciones que puedan afectar la prestación del servicio.`,
  },
  {
    h: '5. Órdenes de taller y seguimiento',
    p: () => `El taller podrá proporcionar al usuario información sobre el estado de sus órdenes de servicio mediante la plataforma u otros canales de comunicación disponibles.\n\nEl estado mostrado en la plataforma tiene carácter informativo y puede actualizarse conforme avance el proceso de diagnóstico, reparación, instalación de repuestos, pruebas y entrega.\n\nLas fechas estimadas de finalización pueden cambiar cuando existan circunstancias técnicas o logísticas que lo justifiquen.`,
  },
  {
    h: '6. Productos, precios y disponibilidad',
    p: () => `El taller ofrece repuestos, accesorios y otros productos a través de su tienda.\n\nLos productos están sujetos a disponibilidad de inventario.\n\nLos precios, características, fotografías y especificaciones de los productos serán mostrados en la plataforma. Podrán existir diferencias entre las imágenes ilustrativas y el producto final cuando estas correspondan a cambios del fabricante o características de presentación.\n\nEl precio y los cargos aplicables serán informados antes de confirmar la compra, incluyendo los impuestos y costos que correspondan.\n\nEn caso de detectarse un error manifiesto en el precio o en la información de un producto, se podrá corregir y comunicará al usuario las opciones disponibles antes de procesar la compra cuando corresponda.`,
  },
  {
    h: '7. Compras y pagos',
    p: () => `El usuario deberá proporcionar información correcta y suficiente para procesar su pedido.\n\nLos medios de pago disponibles serán los que aparezcan habilitados en la plataforma al momento de realizar la compra.\n\nEl procesamiento de pagos podrá realizarse mediante proveedores externos especializados.\n\nNo se almacenará directamente información completa de tarjetas bancarias cuando el procesamiento sea realizado por una plataforma de pagos externa, salvo que ello sea necesario y permitido conforme a las condiciones aplicables.\n\nUna compra se considerará confirmada cuando el sistema confirme la recepción y aceptación del pedido.`,
  },
  {
    h: '8. Envíos y entregas',
    p: () => `Los productos adquiridos podrán enviarse a la dirección proporcionada por el usuario, cuando el servicio de entrega esté disponible para la ubicación indicada.\n\nEl costo de envío, cuando corresponda, será informado antes de finalizar la compra.\n\nLos tiempos de entrega son estimados y pueden variar debido a disponibilidad del producto, ubicación, condiciones de transporte, circunstancias externas o situaciones atribuibles al operador logístico.\n\nEl usuario es responsable de proporcionar correctamente los datos necesarios para la entrega.\n\nEn caso de que un pedido no pueda ser entregado debido a información incorrecta proporcionada por el usuario, podrán generarse costos adicionales o ser necesario coordinar nuevamente la entrega.`,
  },
  {
    h: '9. Retracto, devoluciones, cambios y garantías',
    p: () => `Las devoluciones, cambios, retractos y garantías de productos y servicios ofrecidos se gestionarán de acuerdo con la legislación colombiana aplicable y las condiciones particulares informadas al momento de la compra o contratación.\n\nCuando una compra realizada mediante mecanismos de venta a distancia se encuentre sujeta al derecho de retracto, este podrá ejercerse dentro del plazo y bajo las condiciones establecidas por la legislación vigente, salvo las excepciones legalmente previstas.\n\nLos productos que presenten defectos de calidad, idoneidad o funcionamiento serán atendidos conforme al régimen de garantías aplicable.\n\nEn el caso de servicios de taller, las condiciones de garantía estarán relacionadas con la naturaleza del trabajo realizado, la orden de servicio y las condiciones informadas al cliente, sin limitar los derechos que legalmente correspondan al consumidor.\n\nPara solicitar un cambio, devolución, retracto, garantía o presentar un reclamo, el usuario deberá comunicarse mediante los canales oficiales.`,
  },
  {
    h: '10. Responsabilidades del usuario',
    p: () => `El usuario se compromete a:\n\n• Proporcionar información verdadera y actualizada.\n• Utilizar correctamente la plataforma.\n• Mantener seguras sus credenciales.\n• No utilizar la plataforma para actividades fraudulentas o ilícitas.\n• No intentar acceder sin autorización a cuentas, sistemas o información de otros usuarios.\n• Utilizar los productos adquiridos de acuerdo con las instrucciones del fabricante y las recomendaciones correspondientes.\n\nEl usuario deberá informar al taller sobre cualquier accesorio, objeto personal o condición especial de la motocicleta que pueda ser relevante para la prestación del servicio.`,
  },
  {
    h: '11. Responsabilidad sobre la motocicleta',
    p: () => `El taller tomará las medidas razonables correspondientes durante la recepción y prestación del servicio.\n\nEl cliente deberá informar sobre objetos personales, modificaciones, accesorios o condiciones particulares de la motocicleta que considere relevantes.\n\nNo será responsable por objetos personales que hayan sido dejados dentro de la motocicleta sin haber sido reportados, sin perjuicio de las responsabilidades que legalmente correspondan.\n\nEn caso de daños preexistentes, estos podrán ser registrados durante el proceso de recepción de la motocicleta.`,
  },
  {
    h: '12. Uso adecuado de los productos',
    p: () => `Los repuestos y accesorios deben utilizarse de acuerdo con las especificaciones del fabricante y para el propósito para el cual fueron diseñados.\n\nNo será responsable por daños ocasionados por instalación incorrecta, modificaciones, uso indebido o utilización contraria a las instrucciones del fabricante, sin perjuicio de las garantías y derechos que correspondan legalmente al consumidor.\n\nCuando corresponda, recomendamos que la instalación de determinados repuestos sea realizada por personal técnico capacitado.`,
  },
  {
    h: '13. Privacidad y protección de datos',
    p: () => `El tratamiento de los datos personales de los usuarios se realizará de acuerdo con nuestra Política de Privacidad y la legislación aplicable en materia de protección de datos personales.\n\nAl utilizar determinadas funcionalidades, el usuario podrá proporcionar información relacionada con su cuenta, motocicleta, citas, compras, órdenes y datos de contacto.\n\nPara conocer cómo recopilamos, utilizamos, conservamos y protegemos esta información, consulta nuestra Política de Privacidad.`,
  },
  {
    h: '14. Cookies',
    p: (name: string) => `${name} puede utilizar cookies y tecnologías similares necesarias para el funcionamiento de la plataforma, incluyendo aquellas relacionadas con la sesión, seguridad, carrito de compras y determinadas preferencias.\n\nCuando se utilicen cookies opcionales para analítica, personalización u otras finalidades, estas serán gestionadas de acuerdo con las preferencias del usuario y la normativa aplicable.\n\nEl usuario podrá gestionar sus preferencias mediante las herramientas disponibles en la plataforma.`,
  },
  {
    h: '15. Propiedad intelectual',
    p: (name: string) => `Los contenidos propios de ${name} disponibles en la plataforma, incluyendo textos, diseños, elementos gráficos, logotipos, interfaces y código, pertenecen a ${name} o se utilizan bajo las autorizaciones o licencias correspondientes.\n\nNo está permitida la reproducción, distribución, modificación o utilización comercial no autorizada de dichos contenidos.\n\nLas marcas, logotipos, fotografías o contenidos pertenecientes a terceros continúan siendo propiedad de sus respectivos titulares.`,
  },
  {
    h: '16. Disponibilidad de la plataforma',
    p: (name: string) => `${name} procurará mantener la plataforma disponible y funcionando correctamente.\n\nSin embargo, pueden producirse interrupciones temporales debido a mantenimiento, actualizaciones, fallos técnicos, problemas de conectividad, servicios de terceros, circunstancias de fuerza mayor u otras situaciones fuera del control razonable.\n\nSe podrá realizar modificaciones, actualizaciones o mejoras a la plataforma cuando sea necesario.`,
  },
  {
    h: '17. Modificaciones de los términos',
    p: (name: string) => `${name} podrá actualizar estos Términos y Condiciones cuando resulte necesario debido a cambios legales, técnicos, comerciales u operativos.\n\nLa versión vigente estará disponible en esta página e indicará la fecha de su última actualización.\n\nCuando una modificación requiera informar o solicitar nuevamente la aceptación del usuario conforme a la legislación aplicable, se utilizarán los mecanismos correspondientes.`,
  },
  {
    h: '18. Contacto y reclamaciones',
    p: (name: string, email: string, phone: string, address: string) => `Para consultas, solicitudes, garantías, devoluciones o reclamaciones relacionadas con los productos y servicios, el usuario podrá utilizar los canales oficiales disponibles en la plataforma.\n\nCorreo electrónico: ${email}\nWhatsApp: ${phone}\nDirección: ${address}`,
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
  const { workshop_name: siteName, workshop_phone: sitePhone, workshop_address: siteAddress } = useSiteInfo()
  const name = siteName || 'MotoHouse'
  const phone = sitePhone || ''
  const address = siteAddress || ''
  const email = 'informacion@motohouse.com'

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

  const defaults = isPrivacy ? DEFAULT_PRIVACY : DEFAULT_TERMS

  const builtSections = custom !== null && custom.trim()
    ? parseContent(custom)
    : defaults.map((s) => ({
        h: s.h,
        p: typeof s.p === 'function' ? s.p(name, email, phone, address) : s.p,
      }))

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-carbon-900 dark:text-carbon-700">{title}</h1>
      <p className="mt-1 text-sm text-carbon-500">Última actualización: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
      {custom === null ? (
        <div className="mt-8 space-y-6">
          {builtSections.map((s) => (
            <div key={s.h}>
              <h2 className="font-semibold text-carbon-900">{s.h}</h2>
              <p className="mt-1 text-sm leading-relaxed text-carbon-600 whitespace-pre-line">{s.p}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {builtSections.map((s, idx) => (
            <div key={`${s.h}-${idx}`}>
              <h2 className="font-semibold text-carbon-900 dark:text-carbon-700">{s.h}</h2>
              <p className="mt-1 text-sm leading-relaxed text-carbon-600 dark:text-carbon-400 whitespace-pre-line">{s.p}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
