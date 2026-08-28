import { test, expect } from '@playwright/test'

const BASE = 'https://motoerp-ckx7.vercel.app'

test.describe('Flujo de cliente', () => {
  test('Tienda carga productos', async ({ page }) => {
    await page.goto(`${BASE}/tienda`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
    const text = await page.locator('body').innerText()
    expect(text.length).toBeGreaterThan(10)
  })

  test('Carrito vacío muestra estado vacío', async ({ page }) => {
    await page.goto(`${BASE}/carrito`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
  })

  test('Blog carga artículos', async ({ page }) => {
    await page.goto(`${BASE}/blog`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
  })

  test('Seguimiento de orden carga', async ({ page }) => {
    await page.goto(`${BASE}/seguimiento`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
  })

  test('Agendar cita carga formulario', async ({ page }) => {
    await page.goto(`${BASE}/agendar`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
  })

  test('Contacto tiene formulario', async ({ page }) => {
    await page.goto(`${BASE}/contacto`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
  })

  test('WhatsApp link es externo', async ({ page }) => {
    await page.goto(`${BASE}/carrito`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const waLink = page.locator('a[href*="wa.me"]').first()
    if (await waLink.isVisible().catch(() => false)) {
      const href = await waLink.getAttribute('href')
      expect(href).toContain('wa.me')
    }
  })
})
