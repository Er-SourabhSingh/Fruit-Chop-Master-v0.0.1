# Mobile + PWA Test Cases

## Execution Summary
- Date: April 3, 2026 (Asia/Calcutta)
- Build under test: `master` at commit `ebe4eba`
- Environment:
  - Local server: `python -m http.server 8080 --bind 127.0.0.1`
  - Browser automation: Playwright Chromium
  - Desktop viewport: `1366x768`
  - Mobile emulation: `iPhone 13`
- Overall result: `PASS` (all listed test cases passed)

## Mobile UI Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| MUI-01 | Menu panel stays inside mobile viewport | Open game on iPhone 13 emulation in portrait, wait for menu overlay | Menu panel fully visible, no clipped controls | Panel bounds remained inside viewport | PASS |
| MUI-02 | No horizontal overflow on mobile | Open menu and then start game on mobile emulation | No horizontal scroll/overflow in menu or gameplay | `scrollWidth <= viewportWidth` in both states | PASS |
| MUI-03 | HUD stays inside viewport on mobile | Start match and inspect HUD bounds during active gameplay | HUD remains visible and aligned at top | HUD left/right bounds remained within viewport | PASS |
| MUI-04 | Selection cards are tap-friendly | Inspect `.mode-card` elements on mobile | Cards are easy to tap (height >= 44px) | All cards met touch-size threshold | PASS |

## Gameplay Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| GAME-01 | Desktop game starts and runs | Open desktop view, choose mode, press Start | Game transitions from menu to playable state | HUD appeared and gameplay loop active | PASS |
| GAME-02 | Desktop slicing updates score | Perform repeated swipe gestures after countdown | Human score increases from 0 | Score reached `6` in test run | PASS |
| GAME-03 | Mobile game starts and runs | Open mobile view, select mode, tap Start | Game starts without blank or broken canvas | Gameplay launched and remained visible | PASS |
| GAME-04 | Mobile slicing updates score | Perform repeated touch-pointer swipes on canvas | Human score increases from 0 | Score reached `4` in test run | PASS |

## Touch Interaction Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| TOUCH-01 | Mode selection tappable | Tap Classic/AI cards on mobile | Mode changes without requiring hover | Tap interactions worked correctly | PASS |
| TOUCH-02 | Start button tappable | Tap Start on mobile menu | Match starts | Match started successfully | PASS |
| TOUCH-03 | Touch swipe interaction works | Send realistic touch-pointer swipe path over canvas | Swipe recognized as slice input | Score changed and gameplay responded | PASS |

## PWA Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| PWA-01 | Manifest is configured correctly | Read linked manifest from `index.html` | Manifest exists, standalone display, start_url present | `manifest.json` loaded with expected fields | PASS |
| PWA-02 | Service worker registration/control | Load page, reload once, query SW registration/controller | SW registered and controlling page | Registration and controller both active | PASS |
| PWA-03 | Required app icons available | Fetch 192/512/maskable icon paths | All icon URLs return successful responses | All icons fetched successfully | PASS |
| PWA-04 | Offline core app-shell support | Load once online, switch offline, reload | App shell still opens with menu/canvas | Offline reload kept menu + canvas available | PASS |

## Regression Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| REG-01 | Desktop responsiveness preserved | Run desktop flow end-to-end | Desktop layout and controls remain functional | Desktop flow passed with active gameplay | PASS |
| REG-02 | Mobile responsiveness stable | Run mobile flow end-to-end | No major layout shifts or cropped UI | Mobile layout remained stable | PASS |
| REG-03 | No console errors on normal load | Capture console during normal online load | No runtime console errors | No non-offline console errors detected | PASS |

## Notes
- Intentional offline-mode simulation produces expected network disconnection logs while offline; these were excluded from normal-load error checks.
- Install prompt behavior is browser-dependent, but installability prerequisites (manifest + service worker + icons + offline shell) are verified and passing.
