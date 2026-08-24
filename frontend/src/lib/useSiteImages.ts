import { useEffect, useState } from 'react'
import { api } from './api'

export interface HeroInfo {
  images: string[]
  title?: string
  subtitle?: string
}

export function useHero(page: string): HeroInfo {
  const [hero, setHero] = useState<HeroInfo>({ images: [] })
  useEffect(() => {
    api<{ hero_images?: Record<string, string[]>; hero_texts?: Record<string, { title?: string; subtitle?: string }> }>('/site-info')
      .then((d) => {
        setHero({
          images: (d.hero_images?.[page] ?? []).filter((u) => u),
          title: d.hero_texts?.[page]?.title,
          subtitle: d.hero_texts?.[page]?.subtitle,
        })
      })
      .catch(() => {})
  }, [page])
  return hero
}

export function useHeroImages(page: string): string[] {
  return useHero(page).images
}

export interface SiteInfo {
  workshop_name: string
  workshop_logo: string
  workshop_phone: string
}

let siteCache: SiteInfo | null = null
let sitePromise: Promise<SiteInfo> | null = null

export function useSiteInfo(): SiteInfo {
  const [info, setInfo] = useState<SiteInfo>({ workshop_name: '', workshop_logo: '', workshop_phone: '' })
  useEffect(() => {
    if (!sitePromise) {
      sitePromise = api<{ workshop_name?: string; workshop_logo?: string; workshop_phone?: string }>('/site-info')
        .then((d) => {
          siteCache = { workshop_name: d.workshop_name || '', workshop_logo: d.workshop_logo || '', workshop_phone: d.workshop_phone || '' }
          return siteCache
        })
        .catch(() => {
          siteCache = { workshop_name: '', workshop_logo: '', workshop_phone: '' }
          return siteCache
        })
    }
    sitePromise.then(setInfo)
  }, [])
  return info
}
