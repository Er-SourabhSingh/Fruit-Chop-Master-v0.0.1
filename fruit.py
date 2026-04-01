from __future__ import annotations

from typing import Optional

import pygame

FRUIT_COLORS = {
    "apple": (220, 35, 45),
    "banana": (245, 220, 65),
    "watermelon": (48, 190, 88),
    "pineapple": (245, 180, 55),
    "orange": (250, 140, 25),
}

FRUIT_TYPES = tuple(FRUIT_COLORS.keys())


class Fruit:
    def __init__(
        self,
        name: str,
        position: tuple[float, float],
        velocity: tuple[float, float],
        gravity: float,
        image: Optional[pygame.Surface] = None,
        scale: float = 1.0,
    ) -> None:
        self.name = name
        self.pos = pygame.Vector2(position)
        self.vel = pygame.Vector2(velocity)
        self.gravity = gravity
        self.scale = scale
        self.sliced = False

        self.color = FRUIT_COLORS.get(name, (255, 255, 255))
        self.image: Optional[pygame.Surface] = None

        if image is not None:
            width = max(56, int(image.get_width() * scale))
            height = max(56, int(image.get_height() * scale))
            self.image = pygame.transform.smoothscale(image, (width, height))
            self.radius = min(width, height) * 0.42
        else:
            # This path is only a safety guard. AssetLoader should provide a valid sprite.
            self.radius = 34 * scale

    @property
    def position(self) -> pygame.Vector2:
        return self.pos

    @property
    def collision_radius(self) -> float:
        return self.radius * 0.95

    def update(self, dt: float) -> None:
        self.vel.y += self.gravity * dt
        self.pos += self.vel * dt

    def constrain_horizontal(self, screen_width: int, clamp_velocity: bool = True) -> None:
        left_bound = self.radius
        right_bound = max(left_bound, screen_width - self.radius)

        if self.pos.x < left_bound:
            self.pos.x = left_bound
            if clamp_velocity and self.vel.x < 0:
                self.vel.x = 0
            return

        if self.pos.x > right_bound:
            self.pos.x = right_bound
            if clamp_velocity and self.vel.x > 0:
                self.vel.x = 0

    def draw(self, surface: pygame.Surface) -> None:
        if self.image is None:
            return

        rect = self.image.get_rect(center=(int(self.pos.x), int(self.pos.y)))
        surface.blit(self.image, rect)

    def slice(self) -> None:
        self.sliced = True

    def off_screen(self, screen_height: int, margin: int = 120) -> bool:
        return self.pos.y - self.radius > screen_height + margin
