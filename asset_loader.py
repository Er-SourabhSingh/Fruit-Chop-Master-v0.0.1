from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Optional

import pygame

from fruit import FRUIT_COLORS


class AssetLoader:
    """Centralized asset loading with clear fallback priority.

    Priority:
    1) Real image files from disk.
    2) Programmatically generated fruit-like sprites.
    3) Simple debug circles (Phase 1 placeholder mode).
    """

    IMAGE_EXTENSIONS = (".png", ".webp", ".jpg", ".jpeg")
    SOUND_EXTENSIONS = (".wav", ".ogg", ".mp3")

    def __init__(self, assets_root: Path, debug_placeholders: Optional[bool] = None) -> None:
        self.assets_root = assets_root
        self.fruits_dir = assets_root / "fruits"
        self.bombs_dir = assets_root / "bombs"
        self.effects_dir = assets_root / "effects"
        self.background_dir = assets_root / "background"
        self.sounds_dir = assets_root / "sounds"

        if debug_placeholders is None:
            raw = os.getenv("FRUIT_SLICE_DEBUG_PLACEHOLDERS", "0").strip().lower()
            debug_placeholders = raw in {"1", "true", "yes", "on"}
        self.debug_placeholders = debug_placeholders

    def ensure_directories(self) -> None:
        for folder in (
            self.assets_root,
            self.fruits_dir,
            self.bombs_dir,
            self.effects_dir,
            self.background_dir,
            self.sounds_dir,
        ):
            folder.mkdir(parents=True, exist_ok=True)

    def load_fruit_sprite(self, fruit_name: str) -> pygame.Surface:
        file_sprite = self._load_named_image(self.fruits_dir, fruit_name, convert_alpha=True)
        if file_sprite is not None:
            return file_sprite

        if not self.debug_placeholders:
            generated = self._generate_fruit_like_sprite(fruit_name)
            if generated is not None:
                return generated

        return self._generate_debug_circle_sprite(fruit_name)

    def load_bomb_sprite(self) -> pygame.Surface:
        file_sprite = self._load_named_image(self.bombs_dir, "bomb", convert_alpha=True)
        if file_sprite is not None:
            return file_sprite

        if not self.debug_placeholders:
            return self._generate_bomb_sprite()

        return self._generate_debug_circle_sprite("bomb")

    def load_heart_sprite(self) -> pygame.Surface:
        # Support heart sprites in either effects/ or fruits/ for flexibility.
        for folder in (self.effects_dir, self.fruits_dir):
            file_sprite = self._load_named_image(folder, "heart", convert_alpha=True)
            if file_sprite is not None:
                return file_sprite

        if not self.debug_placeholders:
            return self._generate_heart_sprite()

        return self._generate_debug_circle_sprite("heart")

    def load_background_source(self) -> Optional[pygame.Surface]:
        for stem in ("background", "bg", "stage"):
            image = self._load_named_image(self.background_dir, stem, convert_alpha=False)
            if image is not None:
                return image

        # If no standard file name exists, use the first supported image file.
        for file_path in sorted(self.background_dir.glob("*")):
            if file_path.suffix.lower() in self.IMAGE_EXTENSIONS:
                loaded = self._safe_load_image(file_path, convert_alpha=False)
                if loaded is not None:
                    return loaded
        return None

    def load_effect_sprite(self, effect_name: str) -> Optional[pygame.Surface]:
        return self._load_named_image(self.effects_dir, effect_name, convert_alpha=True)

    def load_sound(self, sound_name: str) -> Optional[pygame.mixer.Sound]:
        for extension in self.SOUND_EXTENSIONS:
            candidate = self.sounds_dir / f"{sound_name}{extension}"
            sound = self._safe_load_sound(candidate)
            if sound is not None:
                return sound
        return None

    def _load_named_image(self, folder: Path, stem: str, convert_alpha: bool) -> Optional[pygame.Surface]:
        for extension in self.IMAGE_EXTENSIONS:
            candidate = folder / f"{stem}{extension}"
            image = self._safe_load_image(candidate, convert_alpha=convert_alpha)
            if image is not None:
                return image
        return None

    @staticmethod
    def _safe_load_image(path: Path, convert_alpha: bool = True) -> Optional[pygame.Surface]:
        if not path.exists():
            return None

        try:
            image = pygame.image.load(str(path))
            return image.convert_alpha() if convert_alpha else image.convert()
        except pygame.error:
            return None

    @staticmethod
    def _safe_load_sound(path: Path) -> Optional[pygame.mixer.Sound]:
        if not path.exists() or not pygame.mixer.get_init():
            return None

        try:
            return pygame.mixer.Sound(str(path))
        except pygame.error:
            return None

    def _generate_fruit_like_sprite(self, fruit_name: str) -> Optional[pygame.Surface]:
        fruit_name = fruit_name.lower()
        size = 128

        if fruit_name == "apple":
            return self._draw_apple(size)
        if fruit_name == "banana":
            return self._draw_banana(size)
        if fruit_name == "watermelon":
            return self._draw_watermelon(size)
        if fruit_name == "pineapple":
            return self._draw_pineapple(size)
        if fruit_name == "orange":
            return self._draw_orange(size)
        return None

    def _generate_bomb_sprite(self) -> pygame.Surface:
        size = 128
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        center = (size // 2, size // 2 + 4)
        radius = int(size * 0.34)

        pygame.draw.circle(surf, (18, 18, 18), center, radius + 6)
        pygame.draw.circle(surf, (35, 35, 35), center, radius)
        pygame.draw.circle(surf, (70, 70, 70), (center[0] - radius // 3, center[1] - radius // 3), radius // 5)
        pygame.draw.line(
            surf,
            (180, 180, 180),
            (center[0] - radius // 2, center[1] - radius // 2),
            (center[0] + radius // 2, center[1] + radius // 2),
            6,
        )
        pygame.draw.line(
            surf,
            (180, 180, 180),
            (center[0] + radius // 2, center[1] - radius // 2),
            (center[0] - radius // 2, center[1] + radius // 2),
            6,
        )

        fuse_start = (center[0], center[1] - radius)
        fuse_end = (center[0] + int(radius * 0.45), center[1] - radius - 18)
        pygame.draw.line(surf, (225, 190, 95), fuse_start, fuse_end, 4)
        pygame.draw.circle(surf, (255, 120, 50), fuse_end, 6)
        return surf

    def _generate_debug_circle_sprite(self, object_name: str) -> pygame.Surface:
        size = 120
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        center = (size // 2, size // 2)
        radius = int(size * 0.34)

        if object_name == "bomb":
            fill = (20, 20, 20)
        elif object_name == "heart":
            fill = (240, 72, 110)
        else:
            fill = FRUIT_COLORS.get(object_name, (220, 220, 220))

        pygame.draw.circle(surf, (30, 30, 30), center, radius + 4)
        pygame.draw.circle(surf, fill, center, radius)

        if object_name == "bomb":
            pygame.draw.line(
                surf,
                (230, 230, 230),
                (center[0] - radius // 2, center[1] - radius // 2),
                (center[0] + radius // 2, center[1] + radius // 2),
                5,
            )
            pygame.draw.line(
                surf,
                (230, 230, 230),
                (center[0] + radius // 2, center[1] - radius // 2),
                (center[0] - radius // 2, center[1] + radius // 2),
                5,
            )
        elif object_name == "heart":
            left_center = (center[0] - radius // 2, center[1] - radius // 4)
            right_center = (center[0] + radius // 2, center[1] - radius // 4)
            lobe_radius = max(6, int(radius * 0.65))
            heart_color = (255, 95, 130)
            pygame.draw.circle(surf, heart_color, left_center, lobe_radius)
            pygame.draw.circle(surf, heart_color, right_center, lobe_radius)
            points = [
                (center[0] - lobe_radius - radius // 3, center[1] - radius // 4),
                (center[0] + lobe_radius + radius // 3, center[1] - radius // 4),
                (center[0], center[1] + int(radius * 1.45)),
            ]
            pygame.draw.polygon(surf, heart_color, points)
        return surf

    @staticmethod
    def _generate_heart_sprite() -> pygame.Surface:
        size = 128
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        center_x = size // 2
        center_y = int(size * 0.56)

        glow_color = (255, 135, 165, 80)
        pygame.draw.circle(surf, glow_color, (center_x, center_y), int(size * 0.34))

        heart_color = (255, 78, 118)
        shadow_color = (220, 52, 92)
        lobe_radius = int(size * 0.20)
        left_lobe = (center_x - int(size * 0.16), center_y - int(size * 0.14))
        right_lobe = (center_x + int(size * 0.16), center_y - int(size * 0.14))

        pygame.draw.circle(surf, shadow_color, (left_lobe[0], left_lobe[1] + 3), lobe_radius)
        pygame.draw.circle(surf, shadow_color, (right_lobe[0], right_lobe[1] + 3), lobe_radius)
        pygame.draw.polygon(
            surf,
            shadow_color,
            [
                (center_x - int(size * 0.34), center_y - int(size * 0.02)),
                (center_x + int(size * 0.34), center_y - int(size * 0.02)),
                (center_x, center_y + int(size * 0.36)),
            ],
        )

        pygame.draw.circle(surf, heart_color, left_lobe, lobe_radius)
        pygame.draw.circle(surf, heart_color, right_lobe, lobe_radius)
        pygame.draw.polygon(
            surf,
            heart_color,
            [
                (center_x - int(size * 0.34), center_y - int(size * 0.06)),
                (center_x + int(size * 0.34), center_y - int(size * 0.06)),
                (center_x, center_y + int(size * 0.32)),
            ],
        )

        highlight = pygame.Surface((size, size), pygame.SRCALPHA)
        pygame.draw.ellipse(
            highlight,
            (255, 215, 225, 125),
            (center_x - int(size * 0.21), center_y - int(size * 0.26), int(size * 0.17), int(size * 0.11)),
        )
        surf.blit(highlight, (0, 0))
        return surf

    @staticmethod
    def _draw_apple(size: int) -> pygame.Surface:
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        center = (size // 2, int(size * 0.56))
        radius = int(size * 0.33)

        pygame.draw.circle(surf, (185, 40, 55), center, radius + 3)
        pygame.draw.circle(surf, (220, 50, 65), center, radius)
        pygame.draw.rect(surf, (120, 75, 50), (center[0] - 3, center[1] - radius - 14, 6, 16))
        pygame.draw.ellipse(
            surf,
            (80, 175, 80),
            (center[0] + 2, center[1] - radius - 18, 26, 15),
        )
        pygame.draw.circle(surf, (255, 255, 255), (center[0] - radius // 3, center[1] - radius // 3), radius // 6)
        return surf

    @staticmethod
    def _draw_orange(size: int) -> pygame.Surface:
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        center = (size // 2, int(size * 0.57))
        radius = int(size * 0.32)
        pygame.draw.circle(surf, (245, 150, 35), center, radius + 2)
        pygame.draw.circle(surf, (255, 168, 44), center, radius)
        pygame.draw.ellipse(surf, (90, 165, 80), (center[0] - 8, center[1] - radius - 16, 18, 12))

        # Small dimples for orange skin detail.
        rng = [(0.2, -0.2), (-0.3, -0.05), (0.12, 0.25), (-0.15, 0.28), (0.35, 0.08)]
        for dx, dy in rng:
            x = center[0] + int(radius * dx)
            y = center[1] + int(radius * dy)
            pygame.draw.circle(surf, (230, 135, 25), (x, y), max(2, radius // 9))
        return surf

    @staticmethod
    def _draw_watermelon(size: int) -> pygame.Surface:
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        center = (size // 2, int(size * 0.57))
        outer = int(size * 0.34)
        middle = int(size * 0.30)
        inner = int(size * 0.26)
        pygame.draw.circle(surf, (20, 95, 45), center, outer)
        pygame.draw.circle(surf, (120, 185, 90), center, middle)
        pygame.draw.circle(surf, (225, 70, 75), center, inner)

        seed_points = [(-0.45, -0.05), (-0.2, -0.25), (0.08, -0.20), (0.32, -0.08), (-0.1, 0.05), (0.2, 0.12)]
        for dx, dy in seed_points:
            x = center[0] + int(inner * dx)
            y = center[1] + int(inner * dy)
            pygame.draw.ellipse(surf, (35, 20, 20), (x, y, 5, 8))
        return surf

    @staticmethod
    def _draw_pineapple(size: int) -> pygame.Surface:
        surf = pygame.Surface((size, size), pygame.SRCALPHA)

        body_rect = pygame.Rect(int(size * 0.26), int(size * 0.30), int(size * 0.48), int(size * 0.56))
        pygame.draw.ellipse(surf, (225, 170, 52), body_rect)
        pygame.draw.ellipse(surf, (245, 190, 65), body_rect.inflate(-8, -10))

        # Diamond-like body pattern.
        pattern_color = (200, 140, 45)
        for offset in range(-40, 50, 16):
            pygame.draw.line(
                surf,
                pattern_color,
                (body_rect.left + 4, body_rect.top + 24 + offset),
                (body_rect.right - 4, body_rect.bottom - 12 + offset),
                2,
            )
            pygame.draw.line(
                surf,
                pattern_color,
                (body_rect.right - 4, body_rect.top + 24 + offset),
                (body_rect.left + 4, body_rect.bottom - 12 + offset),
                2,
            )

        crown_points = [
            ((size * 0.48, size * 0.10), (size * 0.55, size * 0.33), (size * 0.40, size * 0.33)),
            ((size * 0.58, size * 0.14), (size * 0.63, size * 0.33), (size * 0.50, size * 0.33)),
            ((size * 0.38, size * 0.16), (size * 0.45, size * 0.33), (size * 0.32, size * 0.33)),
        ]
        for point_a, point_b, point_c in crown_points:
            pygame.draw.polygon(surf, (70, 165, 75), [point_a, point_b, point_c])
        return surf

    @staticmethod
    def _draw_banana(size: int) -> pygame.Surface:
        surf = pygame.Surface((size, size), pygame.SRCALPHA)

        # Arc-based banana body.
        arc_rect = pygame.Rect(int(size * 0.16), int(size * 0.22), int(size * 0.70), int(size * 0.54))
        start_angle = 0.18 * math.pi
        end_angle = 0.92 * math.pi
        body_width = max(8, size // 7)

        pygame.draw.arc(surf, (235, 214, 75), arc_rect, start_angle, end_angle, body_width + 4)
        pygame.draw.arc(surf, (252, 232, 95), arc_rect, start_angle, end_angle, body_width)

        # Dark underside for depth.
        inner_rect = arc_rect.inflate(-16, -16)
        pygame.draw.arc(surf, (190, 168, 50), inner_rect, start_angle + 0.06, end_angle - 0.08, max(4, body_width // 2))

        # Tips.
        left_tip = (int(size * 0.20), int(size * 0.56))
        right_tip = (int(size * 0.80), int(size * 0.42))
        pygame.draw.circle(surf, (95, 75, 45), left_tip, 4)
        pygame.draw.circle(surf, (95, 75, 45), right_tip, 4)
        return surf
