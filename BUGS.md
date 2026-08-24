# Known bugs

This file is the **only** tracker for defects the tests find. A bug that is not in this table and not in a `test.fail()` case did not happen as far as the suite is concerned.

Rule: when a test finds a product defect,

1. add a row here (`BUG-n`),
2. add a test that asserts the *correct* behaviour and mark it `test.fail()` with this ID,
3. do **not** encode the broken behaviour as a passing assertion.

When the product is fixed, the `test.fail()` case starts passing and CI fails until you drop `test.fail()` and tick **Fixed** below.

| ID | Sev | Test | Product | Correct behaviour (what the test asserts) | Status |
|---|---|---|---|---|---|
| BUG-1 | High | `tests/unit/known-bugs.spec.ts` | `redux/slices/account.slice.ts` `resetAccountState` | After `resetAccountState`, state equals `initialState`. Today Immer `state = initialState` is a no-op; `BlockUpdater` still dispatches it on disconnect. | Open |
| BUG-2 | High | `tests/unit/known-bugs.spec.ts` | `utils/loanCalculations.ts` `getLoanDetailsByCollateralAndStartingLiqPrice` | Returned `startingLiquidationPrice` stays in the same unit as the input / the other two loan helpers. Today it is divided by `10 ** collateralDecimals`. | Open |
| BUG-3 | Medium | `tests/unit/known-bugs.spec.ts` | `components/LoadingScreen.tsx` | Do not named-import `{ version }` from `package.json` (Next.js will drop that). | Open |
| BUG-4 | Low | `tests/e2e/known-bugs.spec.ts` | `pages/404.tsx` | 404 logo `src` is an existing file (`/assets/dEuro-Logo.svg`). Today it is `/assets/logo.svg` (404). | Open |
| BUG-5 | Low | `tests/e2e/known-bugs.spec.ts` | `components/Footer.tsx` `DynamicDocs` | Docs link on `/savings` is a real docs path, not `…/savings-todo`. | Open |
| BUG-6 | Low | `tests/unit/known-bugs.spec.ts` | `redux/slices/positions.slice.ts` | State field is `deniedPositions`. Today it is `deniedPositioins`. | Open |
| BUG-7 | Low | `tests/unit/known-bugs.spec.ts` | `components/Navbar/index.tsx` | No unused `isMainet` binding. | Open |

## Not product bugs

Hidden-DOM Playwright locators (`#ss-mobile-menu`, first “My Referrals” / “Dashboard” hitting desktop nav on mobile) and WalletConnect `already initialized` / `MaxListenersExceeded` under parallel workers on one Next dev server.
