# Fruit Slice (Pygame)

Fruit Ninja-style desktop game built with Python and Pygame.

## Setup

```bash
pip install -r requirements.txt
python main.py
```

## Window
- Resizable window (`pygame.RESIZABLE`)
- Supports maximize/restore
- Minimum interactive size: `640x360`

## Mandatory Asset Folders

```text
assets/
  fruits/
  bombs/
  effects/
  background/
  sounds/
```

## Asset Loader Behavior

The game uses a modular `AssetLoader` system with this priority:

1. Real images from disk (auto-loaded if present)
2. Generated fruit-like sprites (apple with leaf, banana arc, pineapple crown, etc.)
3. Simple debug circles (last fallback)

No code changes are needed when you later add real image files.

### Supported file names

- Fruits: `assets/fruits/apple.png`, `banana.png`, `watermelon.png`, `pineapple.png`, `orange.png`
- Bomb: `assets/bombs/bomb.png`
- Background: `assets/background/background.jpg` (also supports `.png/.webp/.jpeg`)
- Sounds: `assets/sounds/slice.wav`, `bomb.wav`, `combo.wav`

### Phase 1 Placeholder Mode (optional)

To force simple circle placeholders for development:

```bash
# Windows PowerShell
$env:FRUIT_SLICE_DEBUG_PLACEHOLDERS="1"
python main.py
```

Without this flag, the game uses generated fruit-like sprites when image files are missing.

## Modes

The game now includes two playable modes:

- `Classic`: Original fruit-slicing mode with lives, bombs, and high score.
- `AI vs Human`: Timed 60-second competitive round with separate Human and AI scores.

### Start Menu Controls

- `1`: Select Classic mode
- `2`: Select AI vs Human mode
- `Q / W / E`: Set AI difficulty to Easy / Medium / Hard (AI mode)
- `Enter` or `Space`: Start selected mode

### AI vs Human Highlights

- Separate score tracking: Human vs AI
- Top HUD shows Human score, AI score, timer, lives, and AI difficulty
- AI blade trail uses a distinct visual style
- AI behavior is balanced with reaction delay, misses, combos, and bomb mistakes
- Match result screen shows winner, both scores, and high score

## CI/CD (GitHub Actions)

This repository now includes:

- CI workflow: `.github/workflows/ci.yml`
- CD workflow: `.github/workflows/cd.yml`

### CI: automatic quality checks

Runs on:

- Push to `main` or `master`
- Pull request targeting `main` or `master`
- Manual trigger from GitHub Actions tab

Checks performed:

- Install dependencies
- `ruff check .`
- `python -m compileall -q .`
- Headless Pygame smoke test
- `pytest -q` (only when `tests/` exists)

### CD: build and release executable

Runs on:

- Push of tags that start with `v` (example: `v1.0.0`)
- Manual trigger from GitHub Actions tab

What it does:

- Builds Windows executable with PyInstaller
- Uploads `dist/FruitChopMaster.exe` as workflow artifact
- On tag builds, creates a GitHub Release and attaches the EXE

### Release command flow

```bash
git tag v1.0.0
git push origin v1.0.0
```

After pushing the tag, CD will build and publish the release automatically.
