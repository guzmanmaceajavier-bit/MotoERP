export const STAFF_ROLES = ['admin', 'receptionist', 'mechanic'] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

export function isStaffRole(role?: string | null): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role)
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  receptionist: 'Recepcionista',
  mechanic: 'Mecánico',
  customer: 'Cliente',
}

export function roleLabel(role?: string | null): string {
  return (role && ROLE_LABELS[role]) || role || '—'
}
