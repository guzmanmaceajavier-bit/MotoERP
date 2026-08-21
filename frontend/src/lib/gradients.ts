export const GRADIENTS = [
  'from-brand-500 to-brand-700',
  'from-indigo-500 to-indigo-700',
  'from-emerald-500 to-emerald-700',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-700',
  'from-fuchsia-500 to-purple-700',
  'from-rose-500 to-red-700',
  'from-teal-500 to-cyan-700',
]

export function gradientFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}