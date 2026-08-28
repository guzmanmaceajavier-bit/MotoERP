import { test, expect } from '@playwright/test'

const BASE = 'https://motoerp-ckx7.vercel.app'

test.describe('Páginas públicas', () => {
  const pages = [
    { path: '/', name: 'Home', content: 'body' },
    { path: '/tienda', name: 'Tienda', content: 'body' },
    { path: '/servicios', name: 'Servicios', content: 'body' },
    { path: '/contacto', name: 'Contacto', content: 'body' },
    { path: '/blog', name: 'Blog', content: 'body' },
    { path: '/agendar', name: 'Agendar cita', content: 'body' },
    { path: '/nosotros', name: 'Nosotros', content: 'body' },
    { path: '/seguimiento', name: 'Seguimiento', content: 'body' },
    { path: '/login', name: 'Login', content: 'body' },
    { path: '/registro', name: 'Registro', content: 'body' },
    { path: '/carrito', name: 'Carrito', content: 'body' },
  ]

  for (const p of pages) {
    test(`${p.name} carga (${p.path})`, async ({ page }) => {
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' })
      await expect(page.locator(p.content)).toBeVisible()
      const text = await page.locator('body').innerText()
      expect(text.length).toBeGreaterThan(10)
    })
  }

  test('Home tiene header y footer', async ({ page }) => {
    await page.goto(`${BASE}`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
  })
})
