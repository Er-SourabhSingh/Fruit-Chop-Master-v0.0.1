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
