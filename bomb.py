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
        super().draw(surface)

        if self.image is not None:
            return

        pulse = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(self._pulse_phase))
        body_radius = max(3, int(self.radius * 0.95))
        pygame.draw.circle(surface, (40, 40, 42), center, body_radius)

        fuse_start = (
            int(center[0] + self.radius * 0.28),
            int(center[1] - self.radius * 0.76),
        )
        fuse_end = (
            int(fuse_start[0] + self.radius * 0.34),
            int(fuse_start[1] - self.radius * 0.62),
        )
        pygame.draw.line(surface, (92, 72, 36), fuse_start, fuse_end, max(2, int(self.radius * 0.08)))
        spark_radius = max(2, int(self.radius * (0.11 + pulse * 0.07)))
        pygame.draw.circle(surface, (255, 180, 92), fuse_end, spark_radius)
