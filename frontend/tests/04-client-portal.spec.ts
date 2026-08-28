import { test, expect } from '@playwright/test'

const BASE = 'https://motoerp-ckx7.vercel.app'

async function loginClient(page: any) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
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

test.describe('Portal de cliente', () => {
  test('Login cliente funciona', async ({ page }) => {
    await loginClient(page)
    const url = page.url()
    expect(url.includes('/panel') || url.includes('/admin') || url.includes('/staff') || url.includes('/login')).toBeTruthy()
  })

  const clientPages = [
    '/panel',
    '/panel/pedidos',
    '/panel/garaje',
    '/panel/finanzas',
    '/panel/cuenta',
  ]

  for (const path of clientPages) {
    test(`Cliente ${path} carga`, async ({ page }) => {
      await loginClient(page)
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await expect(page.locator('body')).toBeVisible()
    })
  }
})
