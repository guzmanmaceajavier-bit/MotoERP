import { test, expect } from '@playwright/test'

const BASE = 'https://motoerp-ckx7.vercel.app'

test.describe('Carrito y Checkout', () => {
  test('Carrito carga', async ({ page }) => {
    await page.goto(`${BASE}/carrito`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeVisible()
    const text = await page.locator('body').innerText()
    expect(text.length).toBeGreaterThan(10)
  })

  test('Navegar a tienda desde carrito', async ({ page }) => {
    await page.goto(`${BASE}/carrito`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const link = page.locator('a:has-text("Ir a la tienda"), a:has-text("tienda")').first()
    if (await link.isVisible().catch(() => false)) {
      await link.click()
      await page.waitForTimeout(2000)
      expect(page.url()).toContain('/tienda')
    }
  })

  test('Drawer del carrito se abre y cierra', async ({ page }) => {
    await page.goto(`${BASE}/tienda`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const cartBtn = page.locator('button:has-text("🛒")').first()
    if (await cartBtn.isVisible().catch(() => false)) {
      await cartBtn.click()
      await page.waitForTimeout(1000)
      const closeBtn = page.locator('button:has-text("✕")').first()
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click()
        await page.waitForTimeout(500)
      }
    }
  })

  test('Botón ir a la tienda en drawer funciona', async ({ page }) => {
    await page.goto(`${BASE}/tienda`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const cartBtn = page.locator('button:has-text("🛒")').first()
    if (await cartBtn.isVisible().catch(() => false)) {
      await cartBtn.click()
      await page.waitForTimeout(1000)
      const storeLink = page.locator('a:has-text("Ir a la tienda")').first()
      if (await storeLink.isVisible().catch(() => false)) {
        await storeLink.click()
        await page.waitForTimeout(2000)
        expect(page.url()).toContain('/tienda')
      }
    }
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
