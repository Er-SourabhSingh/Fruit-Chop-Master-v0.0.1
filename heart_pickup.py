from __future__ import annotations

import math
import random
from typing import Optional

import pygame

from fruit import Fruit


class HeartPickup(Fruit):
    def __init__(
        self,
        position: tuple[float, float],
        velocity: tuple[float, float],
        gravity: float,
        image: Optional[pygame.Surface] = None,
        scale: float = 1.0,
    ) -> None:
        super().__init__(
            name="heart",
            position=position,
            velocity=velocity,
            gravity=gravity,
            image=image,
            scale=scale,
        )
        self.color = (255, 78, 118)
        self._pulse_phase = random.uniform(0.0, math.tau)
        if image is None:
            self.radius = 28 * scale

    def update(self, dt: float) -> None:
        super().update(dt)
        self._pulse_phase += dt * 6.5

    def draw(self, surface: pygame.Surface) -> None:
        center = (int(self.pos.x), int(self.pos.y))
        super().draw(surface)

        pulse = 0.6 + 0.4 * (0.5 + 0.5 * math.sin(self._pulse_phase))
        ring_radius = int(self.radius + 7 + (pulse * 4))
        pygame.draw.circle(surface, (255, 160, 185), center, ring_radius, width=2)

        if self.image is not None:
            return

        # Fallback heart shape when no sprite is available.
        lobe_radius = max(5, int(self.radius * 0.44))
        left_lobe = (center[0] - int(self.radius * 0.36), center[1] - int(self.radius * 0.22))
        right_lobe = (center[0] + int(self.radius * 0.36), center[1] - int(self.radius * 0.22))
        bottom_point = (center[0], center[1] + int(self.radius * 1.05))
        side_y = center[1] + int(self.radius * 0.03)

        heart_color = (255, 95, 130)
        pygame.draw.circle(surface, heart_color, left_lobe, lobe_radius)
        pygame.draw.circle(surface, heart_color, right_lobe, lobe_radius)
        pygame.draw.polygon(
            surface,
            heart_color,
            [
                (center[0] - lobe_radius - int(self.radius * 0.17), side_y),
                (center[0] + lobe_radius + int(self.radius * 0.17), side_y),
                bottom_point,
            ],
        )
