# Playwright test suite

The dEURO dapp is covered by a single Playwright runner.

## Layout

| Tree | What it proves |
|---|---|
| `tests/unit` | Every exported util, math helper, URL/referral helper, contract batcher, error logger, and Redux reducer branch |
| `tests/e2e` | Every route, nav item, table/tab, form control, i18n locale, mobile menu, wallet connect, write-path guard, and dynamic position/auction URL |
| `tests/helpers` | App-ready wait, injected EIP-1193 wallet, RPC forwarding, fixtures |

## Commands

```bash
yarn test                 # unit + e2e + mobile
yarn test:unit            # no browser UI, still boots Next because of shared webServer
yarn test:e2e             # Chromium desktop
yarn test:e2e:mobile      # iPhone 13 project
```

## Wallet

E2E write paths inject a mock `window.ethereum` (account `0xf39F…2266`). `eth_call` balanceOf returns `maxUint256` so amount forms unlock; `eth_sendTransaction` is captured on `window.__e2eTxs` and never broadcast.

## Environment

`playwright.config.ts` sets `NEXT_PUBLIC_DEPLOYMENT_ENV=dev` and public RPC/API/Ponder URLs. The Next dev server is started automatically.
