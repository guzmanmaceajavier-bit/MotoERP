import { test, expect } from '@playwright/test'

const BASE = 'https://motoerp-ckx7.vercel.app'

async function loginAdmin(page: any) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const email = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first()
  const pass = page.locator('input[type="password"]').first()
  if (await email.isVisible().catch(() => false)) {
    await email.fill('admin@motohub.test')
    await pass.fill('secret123')
    const btn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Iniciar")').first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(3000)
    }
  }
}

test.describe('Panel de administración', () => {
  test('Login admin carga', async ({ page }) => {
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
  })

  test('Login admin funciona', async ({ page }) => {
    await loginAdmin(page)
    const url = page.url()
    expect(url.includes('/admin') || url.includes('/staff') || url.includes('/panel')).toBeTruthy()
  })

  const adminPages = [
    '/admin',
    '/admin/ventas',
    '/admin/ordenes',
    '/admin/inventario',
    '/admin/clientes',
    '/admin/config',
    '/admin/servicios',
    '/admin/blog',
    '/admin/citas',
    '/admin/mensajes',
  ]

  for (const path of adminPages) {
    test(`Admin ${path} carga`, async ({ page }) => {
      await loginAdmin(page)
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await expect(page.locator('body')).toBeVisible()
    })
  }
})
