import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import basicSetup from '../wallet-setup/basic.setup'

const test = testWithSynpress(metaMaskFixtures(basicSetup))

const { expect } = test

test.describe('Wallet Connection', () => {
  test('should display connect wallet button when not connected', async ({ page }) => {
    await page.goto('/')

    // Wait for the page to load and check for connect button
    // The actual selector depends on your app's implementation
    const connectButton = page.getByRole('button', { name: /connect/i })
    await expect(connectButton).toBeVisible({ timeout: 10000 })
  })

  test('should connect MetaMask wallet to the dApp', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    )

    await page.goto('/')

    // Click connect button
    const connectButton = page.getByRole('button', { name: /connect/i })
    await connectButton.click()

    // Wait for wallet modal and select MetaMask
    // Adjust selector based on Web3Modal implementation
    const metamaskOption = page.getByText(/metamask/i).first()
    await metamaskOption.click()

    // Approve connection in MetaMask
    await metamask.connectToDapp()

    // Verify wallet is connected - check for shortened address format
    // The connected state should show a truncated wallet address
    await expect(page.locator('text=/0x[a-fA-F0-9]{4}...?[a-fA-F0-9]{4}/i')).toBeVisible({
      timeout: 15000,
    })
  })

  test('should switch to Citrea Testnet network', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    )

    await page.goto('/')

    // Connect wallet first
    const connectButton = page.getByRole('button', { name: /connect/i })
    await connectButton.click()

    const metamaskOption = page.getByText(/metamask/i).first()
    await metamaskOption.click()

    await metamask.connectToDapp()

    // App should prompt to switch network if not on Citrea Testnet
    // Or verify the correct network is displayed
    await expect(page.locator('text=/citrea|cbtc|testnet/i')).toBeVisible({
      timeout: 15000,
    })
  })
})
