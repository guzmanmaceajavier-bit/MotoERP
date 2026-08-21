export function waLink(phone: string | null | undefined, text?: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '')
  const base = `https://wa.me/${digits}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function waNumber(phone: string | null | undefined): string {
  return (phone || '').replace(/[^\d]/g, '')
}
