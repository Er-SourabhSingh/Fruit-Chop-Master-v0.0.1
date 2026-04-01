from __future__ import annotations

from collections import deque

import pygame


class Blade:
    def __init__(self, max_points: int = 30, trail_lifetime: float = 0.18) -> None:
        self.points: deque[tuple[pygame.Vector2, float]] = deque(maxlen=max_points)
        self.trail_lifetime = trail_lifetime
        self.is_swiping = False
        self._swipe_hits = 0
        self._released_hits = 0

    def reset(self) -> None:
        self.points.clear()
        self.is_swiping = False
        self._swipe_hits = 0
        self._released_hits = 0

    def update(self, mouse_pos: tuple[int, int], mouse_pressed: bool, now: float) -> None:
        current_point = pygame.Vector2(mouse_pos)
        self._trim_old_points(now)

        if mouse_pressed:
            if not self.is_swiping:
                self.is_swiping = True
                self._swipe_hits = 0
                self.points.clear()
                self.points.append((current_point, now))
            else:
                if not self.points or self.points[-1][0].distance_to(current_point) >= 2:
                    self.points.append((current_point, now))
            return

        if self.is_swiping:
            self._released_hits = self._swipe_hits
            self.is_swiping = False

    def register_slice(self) -> None:
        if self.is_swiping:
            self._swipe_hits += 1

    def consume_combo_hits(self) -> int:
        released_hits = self._released_hits
        self._released_hits = 0
        return released_hits

    def rescale(self, scale_x: float, scale_y: float) -> None:
        if not self.points:
            return

        scaled_points = [
            (pygame.Vector2(point.x * scale_x, point.y * scale_y), timestamp)
            for point, timestamp in self.points
        ]
        self.points.clear()
        self.points.extend(scaled_points)

    def get_segments(self) -> list[tuple[pygame.Vector2, pygame.Vector2]]:
        if len(self.points) < 2:
            return []

        points = [point for point, _ in self.points]
        return [(points[i - 1], points[i]) for i in range(1, len(points))]

    def draw(self, surface: pygame.Surface) -> None:
        if len(self.points) < 2:
            return

        points = [point for point, _ in self.points]
        segment_count = len(points) - 1

        for index in range(1, len(points)):
            strength = index / max(1, segment_count)
            width = max(2, int(12 * strength))
            color = (
                int(85 + 155 * strength),
                int(185 + 55 * strength),
                255,
            )

            pygame.draw.line(surface, color, points[index - 1], points[index], width)
            pygame.draw.circle(surface, (255, 255, 255), points[index], max(1, width // 3))

    def _trim_old_points(self, now: float) -> None:
        while self.points and now - self.points[0][1] > self.trail_lifetime:
            self.points.popleft()
