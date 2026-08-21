export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-carbon-200/70 ${className}`} />
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <SkeletonBlock className={`h-3 ${className}`} />
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-carbon-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <SkeletonLine className="w-20" />
        <SkeletonLine className="w-10" />
      </div>
      <SkeletonBlock className="mt-3 h-40 w-full" />
      <SkeletonLine className="mt-3 w-3/4" />
      <SkeletonLine className="mt-2 w-full" />
      <SkeletonLine className="mt-2 w-2/3" />
      <div className="mt-4 flex items-center justify-between">
        <SkeletonLine className="w-16" />
        <SkeletonLine className="w-8" />
      </div>
      <SkeletonBlock className="mt-4 h-10 w-full" />
    </div>
  )
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function RowSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} className={`flex-1 ${c === 0 ? 'w-1/3' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-carbon-200 bg-white p-5">
      <SkeletonLine className="w-24" />
      <SkeletonBlock className="mt-2 h-7 w-20" />
    </div>
  )
}