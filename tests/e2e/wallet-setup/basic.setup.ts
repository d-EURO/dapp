import { defineWalletSetup } from '@synthetixio/synpress'
import { MetaMask } from '@synthetixio/synpress/playwright'

/**
 * Basic wallet setup for E2E tests
 *
 * IMPORTANT: Use a dedicated TEST WALLET only!
 * Never use a wallet with real funds for testing.
 *
 * The seed phrase and password are loaded from environment variables:
 * - WALLET_SEED_PHRASE: Your test wallet's 12-word seed phrase
 * - WALLET_PASSWORD: Password for MetaMask (can be any password for testing)
 *
 * For local testing, you can use the default Hardhat seed phrase:
 * "test test test test test test test test test test test junk"
 */

// Default test wallet seed phrase (Hardhat default - DO NOT USE WITH REAL FUNDS)
const SEED_PHRASE = process.env.WALLET_SEED_PHRASE ||
  'test test test test test test test test test test test junk'

const WALLET_PASSWORD = process.env.WALLET_PASSWORD || 'TestPassword123!'

export default defineWalletSetup(WALLET_PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, WALLET_PASSWORD)

  // Import wallet using seed phrase
  await metamask.importWallet(SEED_PHRASE)

  // Add Citrea Testnet network
  await metamask.addNetwork({
    name: 'Citrea Testnet',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL_TESTNET || 'https://rpc.testnet.citrea.xyz',
    chainId: 5115,
    symbol: 'cBTC',
    blockExplorerUrl: 'https://explorer.testnet.citrea.xyz',
  })

  // Switch to Citrea Testnet
  await metamask.switchNetwork('Citrea Testnet')
})

export { SEED_PHRASE, WALLET_PASSWORD }
