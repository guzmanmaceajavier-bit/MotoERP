export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    per_page: number
    last_page: number
    total: number
    has_more?: boolean
    counts?: Record<string, number>
  }
}

export function isPaginated<T>(res: unknown): res is Paginated<T> {
  return (
    typeof res === 'object' &&
    res !== null &&
    Array.isArray((res as { data?: unknown }).data) &&
    typeof (res as { meta?: unknown }).meta === 'object'
  )
}

export function unwrapList<T>(res: Paginated<T> | T[]): T[] {
  return isPaginated<T>(res) ? res.data : res
}