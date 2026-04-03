# Mobile UI + AI Mode Fix Test Cases

## Execution Summary
- Date: April 3, 2026 (Asia/Calcutta)
- Scope: Mobile UI cleanup, AI HUD placement, mode visibility logic, fruit shadow behavior, AI-mode bomb removal
- Test environment:
  - Local server: `python -m http.server 8080 --bind 127.0.0.1`
  - Automated runner: Playwright Chromium
  - Desktop viewport: `1366x768`
  - Mobile emulation: `iPhone 13`
  - Standalone/PWA approximation: display-mode standalone context
- Overall result: `PASS`

## 1. Mobile UI Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| MUI-01 | Human score visible at top | Start Classic mode on mobile | Human HUD appears only in top area | Human section stayed in top HUD container | PASS |
| MUI-02 | AI score visible at top in AI mode | Start AI vs Human mode on mobile | AI score appears in top HUD | AI section was visible at top only | PASS |
| MUI-03 | No center score/status text | Run gameplay for several seconds | No floating score/status text in play area | Floating text draw calls stayed `0` | PASS |
| MUI-04 | Text readability on phone | Inspect score font sizes and contrast on mobile HUD | Text is readable and not faded | Score font size and contrast passed checks | PASS |
| MUI-05 | No overlap/overflow | Run Classic and AI mode on mobile | No horizontal overflow or overlap | Overflow check passed in both modes | PASS |

## 2. Mode Visibility Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| MODE-01 | AI section hidden in Classic mode | Launch Classic mode | No AI label/score/empty placeholder in HUD | AI section hidden (`hidden` class + classic layout) | PASS |
| MODE-02 | AI section shown in AI mode | Launch AI vs Human mode | AI label and AI score visible | AI section visible with AI layout class | PASS |
| MODE-03 | Mode-specific HUD layout switching | Switch modes from menu and relaunch | HUD layout updates cleanly per mode | `hud--classic`/`hud--ai` toggled correctly | PASS |

## 3. Fruit Rendering Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| FRUIT-01 | No detached/duplicate shadows on desktop | Play Classic mode desktop and sample frame draw counts | Max one shadow per fruit draw | Shadow-to-fruit draw count stayed 1:1 | PASS |
| FRUIT-02 | Mobile shadow artifact prevention | Play Classic mode on mobile | No detached or floating shadows on mobile | Mobile shadow rendering disabled (`renderFruitShadows=false`) | PASS |
| FRUIT-03 | Fruit visuals remain stable | Run repeated swipes desktop/mobile | Fruit rendering remains correct | Fruit visuals remained stable in both contexts | PASS |

## 4. AI Mode Bomb Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| BOMB-01 | No bombs in AI mode (desktop browser) | Run AI mode for 18s and poll object list | Bomb count always zero | `maxBombs=0` | PASS |
| BOMB-02 | No bombs in AI mode (mobile browser) | Run AI mode for 18s on mobile emulation | Bomb count always zero | `maxBombs=0` | PASS |
| BOMB-03 | No bombs in AI mode (PWA/standalone style) | Run AI mode for 15s in standalone context | Bomb count always zero | `maxBombs=0` | PASS |
| BOMB-04 | No AI bomb penalty/status from bombs | Run AI mode and monitor HUD/logic | No bomb penalty triggered | No bomb objects/penalties observed | PASS |

## 5. Regression Test Cases
| ID | Test Case | Steps | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- | --- |
| REG-01 | Classic mode still playable | Start Classic and perform slices (desktop/mobile) | Human score updates correctly | Desktop score `4`, mobile score `18` | PASS |
| REG-02 | Touch input still works | Perform repeated touch swipes on mobile | Slices register and score changes | Touch interactions remained functional | PASS |
| REG-03 | AI mode still playable | Launch AI mode and let round run | AI mode runs with top HUD | Gameplay loop stable with AI scoring | PASS |
| REG-04 | PWA launch prerequisites intact | Validate manifest + service worker in standalone context | PWA opens with standalone-ready config | Manifest/SW checks passed | PASS |
| REG-05 | PWA offline shell still opens | Load once online, switch offline, reload | Menu + canvas still available offline | Offline reload kept menu and canvas visible | PASS |

## Notes
- AI mode bombs are disabled at spawn level and actively filtered during AI rounds to prevent cross-context leakage.
- In-canvas floating score/status text is disabled so score/mode/status data remains in the top HUD only.
- Mobile fruit shadow artifacts are prevented by disabling fruit-shadow rendering on small coarse-pointer viewports.
