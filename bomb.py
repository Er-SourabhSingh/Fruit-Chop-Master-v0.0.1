from __future__ import annotations

import math
import random
from typing import Optional

import pygame

from fruit import Fruit


class Bomb(Fruit):
    def __init__(
        self,
        position: tuple[float, float],
        velocity: tuple[float, float],
        gravity: float,
        image: Optional[pygame.Surface] = None,
        scale: float = 1.0,
    ) -> None:
        super().__init__(
            name="bomb",
            position=position,
            velocity=velocity,
            gravity=gravity,
            image=image,
            scale=scale,
        )
        self.color = (45, 45, 45)
        self._pulse_phase = random.uniform(0.0, math.tau)
        if image is None:
            self.radius = 30 * scale

    def update(self, dt: float) -> None:
        super().update(dt)
        self._pulse_phase += dt * 7.0

    def draw(self, surface: pygame.Surface) -> None:
        center = (int(self.pos.x), int(self.pos.y))
        pulse = 0.65 + 0.35 * (0.5 + 0.5 * math.sin(self._pulse_phase))
        super().draw(surface)

        # High-contrast rings keep bombs visible over bright or busy backgrounds.
        outline_radius = int(self.radius + 3)
        ring_radius = int(self.radius + 8 + pulse * 4)
        pygame.draw.circle(surface, (245, 245, 245), center, outline_radius, width=2)
        pygame.draw.circle(surface, (215, 45, 45), center, ring_radius, width=3)
        pygame.draw.circle(surface, (40, 40, 40), center, max(2, int(self.radius * 0.25)))
