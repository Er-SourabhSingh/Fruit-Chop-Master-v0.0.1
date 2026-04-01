from __future__ import annotations

from collections import deque
from typing import Optional

import pygame


class Blade:
    _LEFT = 1
    _RIGHT = 2
    _TOP = 4
    _BOTTOM = 8

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

    def update(
        self,
        pointer_pos: tuple[float, float],
        pointer_pressed: bool,
        now: float,
        bounds: Optional[tuple[float, float, float, float]] = None,
    ) -> None:
        current_point = pygame.Vector2(pointer_pos)
        self._trim_old_points(now)
        bounded_point = current_point
        inside_bounds = True

        if bounds is not None:
            bounded_point = self._clamp_point(current_point, bounds)
            inside_bounds = self._point_in_bounds(current_point, bounds)

        if not pointer_pressed:
            self._end_swipe()
            return

        if not inside_bounds:
            # Stop slicing immediately when pointer leaves the playable area.
            if self.is_swiping:
                if not self.points or self.points[-1][0].distance_to(bounded_point) >= 2:
                    self.points.append((bounded_point, now))
                self._end_swipe()
            return

        if not self.is_swiping:
            self.is_swiping = True
            self._swipe_hits = 0
            self.points.clear()
            self.points.append((bounded_point, now))
            return

        if not self.points or self.points[-1][0].distance_to(bounded_point) >= 2:
            self.points.append((bounded_point, now))

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

    def get_segments(
        self,
        bounds: Optional[tuple[float, float, float, float]] = None,
    ) -> list[tuple[pygame.Vector2, pygame.Vector2]]:
        if len(self.points) < 2:
            return []

        points = [point for point, _ in self.points]
        segments = [(points[i - 1], points[i]) for i in range(1, len(points))]
        if bounds is None:
            return segments

        clipped_segments: list[tuple[pygame.Vector2, pygame.Vector2]] = []
        for seg_start, seg_end in segments:
            clipped = self._clip_segment_to_bounds(seg_start, seg_end, bounds)
            if clipped is not None:
                clipped_segments.append(clipped)
        return clipped_segments

    def draw(
        self,
        surface: pygame.Surface,
        bounds: Optional[tuple[float, float, float, float]] = None,
    ) -> None:
        draw_bounds = bounds
        if draw_bounds is None:
            draw_bounds = (0.0, 0.0, float(surface.get_width()), float(surface.get_height()))

        segments = self.get_segments(bounds=draw_bounds)
        if not segments:
            return

        segment_count = len(segments)
        left, top, right, bottom = draw_bounds
        clip_rect = pygame.Rect(
            int(left),
            int(top),
            max(1, int(right - left) + 1),
            max(1, int(bottom - top) + 1),
        )
        previous_clip = surface.get_clip()
        surface.set_clip(clip_rect)

        for index, (seg_start, seg_end) in enumerate(segments, start=1):
            strength = index / max(1, segment_count)
            width = max(2, int(12 * strength))
            color = (
                int(85 + 155 * strength),
                int(185 + 55 * strength),
                255,
            )

            pygame.draw.line(surface, color, seg_start, seg_end, width)
            pygame.draw.circle(surface, (255, 255, 255), seg_end, max(1, width // 3))

        surface.set_clip(previous_clip)

    def _trim_old_points(self, now: float) -> None:
        while self.points and now - self.points[0][1] > self.trail_lifetime:
            self.points.popleft()

    def _end_swipe(self) -> None:
        if not self.is_swiping:
            return
        self._released_hits = self._swipe_hits
        self.is_swiping = False

    @staticmethod
    def _point_in_bounds(point: pygame.Vector2, bounds: tuple[float, float, float, float]) -> bool:
        left, top, right, bottom = bounds
        return left <= point.x <= right and top <= point.y <= bottom

    @staticmethod
    def _clamp_point(point: pygame.Vector2, bounds: tuple[float, float, float, float]) -> pygame.Vector2:
        left, top, right, bottom = bounds
        return pygame.Vector2(
            max(left, min(point.x, right)),
            max(top, min(point.y, bottom)),
        )

    @classmethod
    def _out_code(cls, x: float, y: float, bounds: tuple[float, float, float, float]) -> int:
        left, top, right, bottom = bounds
        code = 0

        if x < left:
            code |= cls._LEFT
        elif x > right:
            code |= cls._RIGHT

        if y < top:
            code |= cls._TOP
        elif y > bottom:
            code |= cls._BOTTOM

        return code

    @classmethod
    def _clip_segment_to_bounds(
        cls,
        seg_start: pygame.Vector2,
        seg_end: pygame.Vector2,
        bounds: tuple[float, float, float, float],
    ) -> Optional[tuple[pygame.Vector2, pygame.Vector2]]:
        left, top, right, bottom = bounds
        x0, y0 = seg_start.x, seg_start.y
        x1, y1 = seg_end.x, seg_end.y

        while True:
            out0 = cls._out_code(x0, y0, bounds)
            out1 = cls._out_code(x1, y1, bounds)

            if not (out0 | out1):
                return pygame.Vector2(x0, y0), pygame.Vector2(x1, y1)

            if out0 & out1:
                return None

            out_code_out = out0 if out0 else out1
            if out_code_out & cls._BOTTOM:
                if y1 == y0:
                    return None
                x = x0 + ((x1 - x0) * (bottom - y0) / (y1 - y0))
                y = bottom
            elif out_code_out & cls._TOP:
                if y1 == y0:
                    return None
                x = x0 + ((x1 - x0) * (top - y0) / (y1 - y0))
                y = top
            elif out_code_out & cls._RIGHT:
                if x1 == x0:
                    return None
                y = y0 + ((y1 - y0) * (right - x0) / (x1 - x0))
                x = right
            else:
                if x1 == x0:
                    return None
                y = y0 + ((y1 - y0) * (left - x0) / (x1 - x0))
                x = left

            if out_code_out == out0:
                x0, y0 = x, y
            else:
                x1, y1 = x, y
