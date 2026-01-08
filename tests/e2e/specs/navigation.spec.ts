import { testWithSynpress } from '@synthetixio/synpress'
import { metaMaskFixtures } from '@synthetixio/synpress/playwright'
import basicSetup from '../wallet-setup/basic.setup'

const test = testWithSynpress(metaMaskFixtures(basicSetup))

const { expect } = test

test.describe('Navigation', () => {
  test('should load home page and redirect to dashboard', async ({ page }) => {
    await page.goto('/')

    // Home page redirects to dashboard
    await expect(page).toHaveURL(/dashboard/)
  })

  test('should navigate to mint page', async ({ page }) => {
    await page.goto('/mint')

    await expect(page).toHaveURL(/mint/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('should navigate to savings page', async ({ page }) => {
    await page.goto('/savings')

    await expect(page).toHaveURL(/savings/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('should navigate to equity page', async ({ page }) => {
    await page.goto('/equity')

    await expect(page).toHaveURL(/equity/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('should navigate to governance page', async ({ page }) => {
    await page.goto('/governance')

    await expect(page).toHaveURL(/governance/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('should navigate to challenges page', async ({ page }) => {
    await page.goto('/challenges')

    await expect(page).toHaveURL(/challenges/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('should navigate to swap page', async ({ page }) => {
    await page.goto('/swap')

    await expect(page).toHaveURL(/swap/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('should navigate to referrals page', async ({ page }) => {
    await page.goto('/referrals')

    await expect(page).toHaveURL(/referrals/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display 404 for invalid routes', async ({ page }) => {
    await page.goto('/invalid-page-that-does-not-exist')

    // Check for 404 page content
    await expect(page.locator('text=/404|not found|page not found/i')).toBeVisible({
      timeout: 10000,
    })
  })
})
