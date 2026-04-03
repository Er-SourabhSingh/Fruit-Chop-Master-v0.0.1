# Mobile UI + AI Mode Rework Test Cases

## Execution Summary
- Date: April 3, 2026 (Asia/Calcutta)
- Scope: Full rework for mobile HUD, fruit-shadow removal on phone contexts, and complete bomb removal in AI mode
- Commit under validation: local working tree before commit
- Test stack:
  - Local server: `python -m http.server 8080 --bind 127.0.0.1`
  - Playwright Chromium automation
  - Desktop viewport: `1366x768`
  - Mobile viewport: `iPhone 13` emulation (portrait)
  - Installed-app/PWA simulation: standalone display-mode context
- Final automated result: `PASS`
- Reference metrics from run:
  - Classic desktop score after swipes: `6`
  - Classic mobile score after touch swipes: `3`
  - AI mode max bomb count (desktop/mobile/standalone): `0/0/0`

## A. Mobile Shadow Check
| ID | Test Case | Steps | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| SH-01 | Mobile shadow disabled | Start Classic mode on mobile and inspect render flag | Fruit shadows disabled on phone context | `renderFruitShadows=false` | PASS |
| SH-02 | No shadow draw calls on mobile | Sample recent frames while fruits spawn and slice | No detached/duplicate fruit-shadow layer | Total mobile shadow draw calls = `0` | PASS |
| SH-03 | Standalone/PWA shadow disabled | Start AI mode in standalone context | No mobile-style shadow artifact in installed app/PWA | `renderFruitShadows=false` in standalone | PASS |

## B. HUD Top Layout Check
| ID | Test Case | Steps | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| HUD-01 | Human HUD top-left (Classic desktop) | Start Classic desktop mode | Human score/lives block at top-left | Human block stayed in top-left bounds | PASS |
| HUD-02 | Human HUD top-left (Classic mobile) | Start Classic mobile mode | Human block remains top-left on portrait phone | Human block stayed top-left and in viewport | PASS |
| HUD-03 | AI HUD top-right (AI desktop) | Start AI desktop mode | AI score/status appears top-right | AI block stayed top-right | PASS |
| HUD-04 | AI HUD top-right (AI mobile) | Start AI mobile mode | AI score/status appears top-right | AI block stayed top-right | PASS |
| HUD-05 | No center gameplay text | Run Classic + AI and inspect HUD/canvas text paths | No score/status labels drawn in center gameplay area | Center HUD hidden + floating text draw calls = `0` | PASS |
| HUD-06 | Classic mode hides AI HUD | Start Classic mode | No AI label/score section | AI section hidden in Classic | PASS |

## C. Bomb Removal in AI Mode
| ID | Test Case | Steps | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| BOMB-01 | No bomb spawn in AI desktop | Run AI mode 18s while polling objects | Bombs never created | Max bomb count = `0` | PASS |
| BOMB-02 | No bomb spawn in AI mobile browser | Run AI mode 18s on mobile emulation | Bombs never created | Max bomb count = `0` | PASS |
| BOMB-03 | No bomb spawn in AI standalone app context | Run AI mode 15s in standalone mode | Bombs never created | Max bomb count = `0` | PASS |
| BOMB-04 | No AI bomb penalty in AI mode | Monitor AI status text during AI rounds | No bomb-mistake penalty text | No `Mistake` status observed | PASS |

## D. Platform + Regression Check
| ID | Test Case | Steps | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| REG-01 | Classic desktop gameplay | Slice fruits repeatedly | Score increases; desktop flow intact | Score increased to `6` | PASS |
| REG-02 | Classic mobile gameplay | Swipe touch repeatedly | Score increases; touch intact | Score increased to `3` | PASS |
| REG-03 | AI desktop gameplay | Start AI mode and run active round | AI gameplay stable with top HUD | Stable run with no bomb objects | PASS |
| REG-04 | AI mobile gameplay | Start AI mode on mobile portrait | AI gameplay stable with top HUD | Stable run with no bomb objects | PASS |
| REG-05 | PWA prerequisites | Validate manifest + SW in standalone context | Installable standalone configuration | Manifest + SW checks passed | PASS |
| REG-06 | Offline standalone/PWA shell | Load online once, then reload offline | Menu + canvas available offline | Offline menu + canvas present | PASS |

## Notes
- Rework explicitly removes AI-mode bomb creation and AI bomb-target decision path, then additionally filters any unexpected bomb object during AI rounds as a safety guard.
- Center HUD container remains in DOM for compatibility but is intentionally hidden during gameplay to keep score/status information strictly in top left/right HUD blocks.
