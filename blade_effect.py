from __future__ import annotations

from dataclasses import dataclass

import pygame


@dataclass
class SlashTrail:
    start: pygame.Vector2
    end: pygame.Vector2
    color: tuple[int, int, int]
    width: int
    life: float
    max_life: float


class BladeEffect:
    def __init__(self, max_trails: int = 14) -> None:
        self.max_trails = max_trails
        self.trails: list[SlashTrail] = []

    def clear(self) -> None:
        self.trails.clear()

    def add_slash(
        self,
        start: pygame.Vector2,
        end: pygame.Vector2,
        color: tuple[int, int, int],
        width: int = 8,
        duration: float = 0.24,
    ) -> None:
        self.trails.append(
            SlashTrail(
                start=start.copy(),
                end=end.copy(),
                color=color,
                width=max(2, width),
                life=max(0.06, duration),
                max_life=max(0.06, duration),
            )
        )
        if len(self.trails) > self.max_trails:
            overflow = len(self.trails) - self.max_trails
            del self.trails[:overflow]

    def update(self, dt: float) -> None:
        if not self.trails:
            return

        alive: list[SlashTrail] = []
        for trail in self.trails:
            trail.life -= dt
            if trail.life > 0.0:
                alive.append(trail)
        self.trails = alive

    def draw(self, surface: pygame.Surface) -> None:
        if not self.trails:
            return

        overlay = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
        for trail in self.trails:
            age = 1.0 - (trail.life / trail.max_life)
            travel_progress = min(1.0, age / 0.35)
            alpha = int(255 * max(0.0, 1.0 - age))
            dynamic_width = max(2, int(trail.width * (1.0 - (age * 0.45))))
            visible_end = trail.start.lerp(trail.end, travel_progress)
            draw_color = (*trail.color, alpha)

            pygame.draw.line(overlay, draw_color, trail.start, visible_end, dynamic_width)
            pygame.draw.circle(overlay, draw_color, visible_end, max(2, dynamic_width // 2))
        surface.blit(overlay, (0, 0))

    def rescale(self, scale_x: float, scale_y: float) -> None:
        for trail in self.trails:
            trail.start.x *= scale_x
            trail.start.y *= scale_y
            trail.end.x *= scale_x
            trail.end.y *= scale_y
