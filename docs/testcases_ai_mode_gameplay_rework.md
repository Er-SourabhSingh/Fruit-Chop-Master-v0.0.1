# AI Mode Gameplay Rework Test Cases

## Execution Summary
- Date: April 3, 2026 (Asia/Calcutta)
- Scope: AI-vs-Human gameplay rework (AI slicing reliability, zero bombs in AI mode, AI hardness, fruit scaling 5->15)
- Build under validation: local working tree before commit
- Test stack:
  - Local server: `python -m http.server 8080 --bind 127.0.0.1`
  - Playwright Chromium automation
  - Desktop viewport: `1366x768`
  - Mobile viewport: `Pixel 7` and `iPhone 13` emulation
  - PWA/installed-app simulation: standalone display-mode emulation
- Result: `PASS`

## A. AI Mode Competition Tests
| ID | Test Case | Platform | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| AI-01 | AI mode starts and runs | Desktop browser | AI mode starts without runtime errors | Started and stayed active | PASS |
| AI-02 | AI mode starts and runs | Mobile browser | AI mode starts without runtime errors | Started and stayed active | PASS |
| AI-03 | AI mode starts and runs | PWA standalone | AI mode starts without runtime errors | Started and stayed active | PASS |
| AI-04 | AI mode starts and runs | Installed-app simulation | AI mode starts without runtime errors | Started and stayed active | PASS |
| AI-05 | AI scoring progression | All AI scenarios | AI score increases consistently during active round | Desktop `0->117`, Mobile `0->107`, PWA `0->109`, Installed `0->118` | PASS |

## B. Bomb Removal Tests (AI Mode)
| ID | Test Case | Platform | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| BOMB-01 | Bomb spawn check | Desktop browser | No bombs created in AI mode | Max bomb count `0` | PASS |
| BOMB-02 | Bomb spawn check | Mobile browser | No bombs created in AI mode | Max bomb count `0` | PASS |
| BOMB-03 | Bomb spawn check | PWA standalone | No bombs created in AI mode | Max bomb count `0` | PASS |
| BOMB-04 | Bomb spawn check | Installed-app simulation | No bombs created in AI mode | Max bomb count `0` | PASS |

## C. HUD + Mode Visibility Tests
| ID | Test Case | Platform | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| HUD-01 | AI HUD visible in AI mode | Desktop/Mobile/PWA/Installed | AI section visible and aligned at top-right | Visible in all scenarios; top-aligned with Human section | PASS |
| HUD-02 | Classic mode hides AI HUD | Desktop browser | AI section hidden in Classic | Hidden at start and after play | PASS |
| HUD-03 | Classic mode hides AI HUD | Mobile browser | AI section hidden in Classic | Hidden at start and after play | PASS |

## D. Fruit Scaling Tests (AI Mode)
| ID | Test Case | Platform | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| SCALE-01 | Early-round density | Desktop browser | Early AI mode starts around 5 fruits | Early max active fruits `6` | PASS |
| SCALE-02 | Late-round density | Desktop browser | Late AI mode scales up toward 15 fruits | Late max active fruits `16` | PASS |

## E. Regression Tests
| ID | Test Case | Platform | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| REG-01 | Classic desktop playability | Desktop browser | Human slicing still works | Human score `2` after swipe simulation | PASS |
| REG-02 | Classic mobile playability | Mobile browser | Human slicing still works | Human score `2` after swipe simulation | PASS |
| REG-03 | Offline app shell | PWA standalone | App loads after first load when offline | SW ready `true`, offline load `true` | PASS |

## Notes
- Installed-phone-app behavior was validated via standalone display-mode emulation (same code path used by installed PWA context).
- Real physical-device validation is still recommended before production release to confirm OEM/browser-specific rendering and input nuances.
