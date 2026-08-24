# Known bugs (from Playwright work)

Found while building the Playwright suite in #335. Not yet fixed. Newest first is not required here — ordered by severity.

| ID | Severity | Where | What | Fix |
|---|---|---|---|---|
| BUG-1 | High | `redux/slices/account.slice.ts` `resetAccountState` | Immer assignment `state = initialState` does not mutate the store. `BlockUpdater` calls this on wallet disconnect, so `loading` / `error` stay set. | `return initialState` (or reset fields in place). Prove with `tests/unit/redux.spec.ts`. |
| BUG-2 | High | `utils/loanCalculations.ts` `getLoanDetailsByCollateralAndStartingLiqPrice` | Return value `startingLiquidationPrice` is divided by `10 ** collateralDecimals`. The other two loan helpers do not. Start and end liquidation prices are in different units; the UI can show a wrong start price. | Return the same unit as `getLoanDetailsByCollateralAndLiqPrice` / `…YouGetAmount`. Cover in `tests/unit/loanCalculations.spec.ts`. |
| BUG-3 | Medium | `components/LoadingScreen.tsx` | Named import `{ version }` from `package.json`. Next.js warns on every load: named export from a default-exporting module will go away. | `import pkg from "../package.json"` then `pkg.version`. |
| BUG-4 | Low | `pages/404.tsx` | Image `src="/assets/logo.svg"` — file does not exist. Real logo is `/assets/dEuro-Logo.svg`. | Point at the existing asset. E2E: `tests/e2e/navigation.spec.ts` (404). |
| BUG-5 | Low | `components/Footer.tsx` `DynamicDocs` | On `/savings` the docs link is `https://docs.deuro.com/savings-todo` (placeholder). | Real savings docs path. |
| BUG-6 | Low | `redux/slices/positions.slice.ts` (+ types) | Typo `deniedPositioins` in state, types, and filter. Consistent, so no crash, but every consumer must copy the misspelling. | Rename to `deniedPositions`. |
| BUG-7 | Low | `components/Navbar/index.tsx` | `const isMainet = useIsMainnet()` is unused (and misspelled). | Remove. |

## Out of scope (not product bugs)

Playwright failures from hidden DOM (`#ss-mobile-menu`, first “My Referrals” / “Dashboard” matching the desktop nav on mobile) and WalletConnect `already initialized` / `MaxListenersExceeded` under parallel workers against one Next dev server.

## Status

Open. No GitHub issues yet — this file is the tracker until someone files them or a fix PR lands.
