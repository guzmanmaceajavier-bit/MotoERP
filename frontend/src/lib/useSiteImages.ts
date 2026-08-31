import { useEffect, useState } from 'react'
import { api } from './api'

export interface HeroInfo {
  images: string[]
  title?: string
  subtitle?: string
  slides?: { image: string; title?: string; subtitle?: string }[]
}

export function useHero(page: string): HeroInfo {
  const [hero, setHero] = useState<HeroInfo>({ images: [] })
  useEffect(() => {
    api<{ hero_images?: Record<string, string[]>; hero_texts?: Record<string, { title?: string; subtitle?: string } | { title?: string; subtitle?: string }[]> }>('/site-info')
      .then((d) => {
        const images = (d.hero_images?.[page] ?? []).filter((u) => u)
        const raw = d.hero_texts?.[page]
        const slides = images.map((img, i) => {
          const txt = Array.isArray(raw) ? (raw[i] as { title?: string; subtitle?: string } | undefined) : (i === 0 ? (raw as { title?: string; subtitle?: string } | undefined) : undefined)
          return { image: img, title: txt?.title, subtitle: txt?.subtitle }
        })
        setHero({
          images,
          title: Array.isArray(raw) ? (raw[0] as { title?: string } | undefined)?.title : (raw as { title?: string } | undefined)?.title,
          subtitle: Array.isArray(raw) ? (raw[0] as { subtitle?: string } | undefined)?.subtitle : (raw as { subtitle?: string } | undefined)?.subtitle,
          slides,
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
  workshop_address: string
  workshop_map_lat: string
  workshop_map_lng: string
}

let siteCache: SiteInfo | null = null
let sitePromise: Promise<SiteInfo> | null = null

export function useSiteInfo(): SiteInfo {
  const [info, setInfo] = useState<SiteInfo>({ workshop_name: '', workshop_logo: '', workshop_phone: '', workshop_address: '', workshop_map_lat: '', workshop_map_lng: '' })
  useEffect(() => {
    if (!sitePromise) {
      sitePromise = api<{ workshop_name?: string; workshop_logo?: string; workshop_phone?: string; workshop_address?: string; workshop_map_lat?: string; workshop_map_lng?: string }>('/site-info')
        .then((d) => {
          siteCache = { workshop_name: d.workshop_name || '', workshop_logo: d.workshop_logo || '', workshop_phone: d.workshop_phone || '', workshop_address: d.workshop_address || '', workshop_map_lat: d.workshop_map_lat || '', workshop_map_lng: d.workshop_map_lng || '' }
          return siteCache
        })
        .catch(() => {
          siteCache = { workshop_name: '', workshop_logo: '', workshop_phone: '', workshop_address: '', workshop_map_lat: '', workshop_map_lng: '' }
          return siteCache
        })
    }
    sitePromise.then(setInfo)
  }, [])
  return info
}
