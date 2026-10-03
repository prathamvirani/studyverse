# MID-02 visual evidence

Captured 2026-09-20 from the production Nuxt build in the isolated HTTPS browser harness. These are generated test identities, not real account screenshots. Full-page images include fixed navigation at its viewport position; this can overlay an intermediate part of a tall capture without representing document reflow.

The auth card, three onboarding steps, ultrawide previews, desktop/tablet/mobile account cards, Light/Dark/System response and mobile deletion sheet were visually inspected. Width/overflow, provider image decoding, preference persistence and deletion local cleanup are also asserted by the browser tests.

| Screenshot                                             | Pixel dimensions (full document) |
| ------------------------------------------------------ | -------------------------------- |
| [account-dark-mobile.png](account-dark-mobile.png)     | 390 × 3097                       |
| [account-desktop.png](account-desktop.png)             | 1440 × 2054                      |
| [account-mobile.png](account-mobile.png)               | 390 × 3097                       |
| [account-tablet.png](account-tablet.png)               | 820 × 2746                       |
| [auth-dark-mobile.png](auth-dark-mobile.png)           | 390 × 844                        |
| [auth-light.png](auth-light.png)                       | 1440 × 900                       |
| [auth-tablet.png](auth-tablet.png)                     | 820 × 1180                       |
| [delete-confirmation.png](delete-confirmation.png)     | 390 × 2775                       |
| [local-stack-home.png](local-stack-home.png)           | 1440 × 900                       |
| [onboarding-appearance.png](onboarding-appearance.png) | 2560 × 1080                      |
| [onboarding-identity.png](onboarding-identity.png)     | 2560 × 1080                      |
| [onboarding-ultrawide.png](onboarding-ultrawide.png)   | 2560 × 1080                      |

`local-stack-home.png` and [local-smoke.json](local-smoke.json) are from a fresh isolated browser against the refreshed local stack at https://localhost:8443/home. No real account was signed in or deleted during that smoke. Stale HttpOnly cookie: protected profile 401, public providers 200, both provider marks loaded, no page/CSP errors.

Reproduce MID-02 fixture evidence after a production build with `npx playwright test tests/browser/account-ux.spec.ts`; output is `.local/validation/mid02`. The historical MID-00 capture was not rerun or overwritten. MID-01 screenshot reports remain historical; its regression tests still exercise the accepted materials and route loader with authenticated setup.

Viewport captures are not physical-device, screen-reader or external OAuth certification. See the [implementation report](../../reports/MID_02_AUTH_ONBOARDING_ACCOUNT_REPORT.md) for scope, policy and validation limits.
