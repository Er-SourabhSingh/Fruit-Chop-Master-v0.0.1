from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Optional

import pygame

from blade_effect import BladeEffect
from bomb import Bomb
from difficulty_manager import DifficultyManager
from fruit import Fruit
from heart_pickup import HeartPickup
from score_manager import ScoreManager


@dataclass
class AIDecision:
    sliced_targets: list[Fruit]
    bomb_target: Optional[Bomb]
    points_gained: int
    combo_bonus: int


class AIPlayer:
    def __init__(self, difficulty_level: str = DifficultyManager.DEFAULT_LEVEL) -> None:
        self.rng = random.Random()
        self.score = 0
        self.combo_text = ""
        self.combo_timer = 0.0
        self.status_text = ""
        self.status_timer = 0.0

        self._difficulty_level = ""
        self.profile = DifficultyManager.profile_for(difficulty_level)
        self.set_difficulty(difficulty_level)
        self._next_action_at = 0.0
        self.blade_effect = BladeEffect(max_trails=12)
        self._visible_since: dict[int, float] = {}
        self._reaction_delay_by_object: dict[int, float] = {}

    @property
    def difficulty_level(self) -> str:
        return self._difficulty_level

    @property
    def difficulty_label(self) -> str:
        return self.profile.label

    def set_difficulty(self, difficulty_level: str) -> None:
        self._difficulty_level = difficulty_level.lower()
        self.profile = DifficultyManager.profile_for(self._difficulty_level)

    def reset(self, now: float) -> None:
        self.score = 0
        self.combo_text = ""
        self.combo_timer = 0.0
        self.status_text = ""
        self.status_timer = 0.0
        self._next_action_at = now + self.profile.sample_reaction_delay(self.rng)
        self.blade_effect.clear()
        self._visible_since.clear()
        self._reaction_delay_by_object.clear()

    def update_timers(self, dt: float) -> None:
        self.blade_effect.update(dt)
        if self.combo_timer > 0.0:
            self.combo_timer = max(0.0, self.combo_timer - dt)
        if self.status_timer > 0.0:
            self.status_timer = max(0.0, self.status_timer - dt)

    def decide_action(
        self,
        now: float,
        objects: list[Fruit],
        arena_width: int,
        arena_height: int,
        round_progress: float,
    ) -> Optional[AIDecision]:
        self._sync_visibility_tracking(now, objects, arena_width, arena_height)

        if now < self._next_action_at:
            return None

        reactable_objects = [
            obj
            for obj in objects
            if self._is_fully_visible(obj, arena_width, arena_height) and self._reaction_ready(obj, now)
        ]
        regular_fruits = [
            obj
            for obj in reactable_objects
            if not isinstance(obj, (Bomb, HeartPickup))
        ]
        heart_pickups = [obj for obj in reactable_objects if isinstance(obj, HeartPickup)]
        bombs = [obj for obj in reactable_objects if isinstance(obj, Bomb)]

        if not regular_fruits and not heart_pickups and not bombs:
            self._next_action_at = now + min(0.16, self.profile.sample_reaction_delay(self.rng) * 0.45)
            return None

        # Keep difficulty fair across a match. AI can become slightly sharper later,
        # but never reaches perfect behavior.
        pressure = (round_progress - 0.5) * 0.06
        fruit_hit_chance = self.profile.sample_fruit_hit_chance(self.rng)
        fruit_hit_chance = max(0.15, min(0.96, fruit_hit_chance + pressure))

        combo_chance = self.profile.sample_combo_chance(self.rng)
        combo_chance = max(0.0, min(0.88, combo_chance + (pressure * 0.8)))

        slicable_targets = [*regular_fruits, *heart_pickups]
        targets = self._pick_targets(slicable_targets, combo_chance, arena_width)
        sliced_targets = [target for target in targets if self.rng.random() < fruit_hit_chance]
        scored_targets = [target for target in sliced_targets if not isinstance(target, HeartPickup)]

        combo_bonus = 0
        points_gained = 0
        if scored_targets:
            points_gained = len(scored_targets)
            if len(scored_targets) > 1:
                combo_bonus = ScoreManager.combo_bonus_for_hits(len(scored_targets))
                points_gained += combo_bonus
                self.combo_text = ScoreManager.ai_combo_text(len(scored_targets), combo_bonus)
                self.combo_timer = 1.0
            else:
                self.status_text = "AI Slice"
                self.status_timer = 0.55

            self.score += points_gained
            self._spawn_slice_trail(sliced_targets, success=True, arena_width=arena_width, arena_height=arena_height)
        elif sliced_targets:
            self.status_text = "AI Slice"
            self.status_timer = 0.45
            self._spawn_slice_trail(sliced_targets, success=True, arena_width=arena_width, arena_height=arena_height)
        elif targets:
            self._spawn_slice_trail([targets[0]], success=False, arena_width=arena_width, arena_height=arena_height)

        bomb_target: Optional[Bomb] = None
        if bombs and self._should_make_bomb_mistake():
            bomb_target = self.rng.choice(bombs)
            self._spawn_slice_trail(
                [bomb_target],
                success=False,
                bomb=True,
                arena_width=arena_width,
                arena_height=arena_height,
            )

        self._next_action_at = now + self.profile.sample_reaction_delay(self.rng)
        if not sliced_targets and bomb_target is None:
            self._next_action_at = now + max(0.08, self.profile.sample_reaction_delay(self.rng) * 0.7)

        if not sliced_targets and bomb_target is None:
            return None

        return AIDecision(
            sliced_targets=sliced_targets,
            bomb_target=bomb_target,
            points_gained=points_gained,
            combo_bonus=combo_bonus,
        )

    def apply_bomb_penalty(self, penalty: int) -> None:
        penalty_value = max(0, penalty)
        self.score = max(0, self.score - penalty_value)
        self.status_text = f"AI Mistake -{penalty_value}"
        self.status_timer = 1.0

    def draw(self, surface: pygame.Surface) -> None:
        self.blade_effect.draw(surface)

    def rescale(self, scale_x: float, scale_y: float) -> None:
        self.blade_effect.rescale(scale_x, scale_y)

    @staticmethod
    def _is_fully_visible(obj: Fruit, arena_width: int, arena_height: int) -> bool:
        left = obj.position.x - obj.radius
        right = obj.position.x + obj.radius
        top = obj.position.y - obj.radius
        bottom = obj.position.y + obj.radius
        return left >= 0 and top >= 0 and right <= arena_width and bottom <= arena_height

    def _reaction_ready(self, obj: Fruit, now: float) -> bool:
        obj_id = id(obj)
        visible_since = self._visible_since.get(obj_id)
        reaction_delay = self._reaction_delay_by_object.get(obj_id)
        if visible_since is None or reaction_delay is None:
            return False
        return (now - visible_since) >= reaction_delay

    def _pick_targets(self, candidates: list[Fruit], combo_chance: float, arena_width: int) -> list[Fruit]:
        if not candidates:
            return []

        center_x = arena_width * 0.5
        sorted_candidates = sorted(candidates, key=lambda fruit: (fruit.position.y, abs(fruit.position.x - center_x)))
        if len(sorted_candidates) == 1:
            return [sorted_candidates[0]]

        if self.rng.random() >= combo_chance:
            return [sorted_candidates[0]]

        seed = sorted_candidates[0]
        nearby = sorted(
            sorted_candidates,
            key=lambda fruit: seed.position.distance_squared_to(fruit.position),
        )
        target_count = 2
        if len(nearby) >= 3 and self.rng.random() < 0.36:
            target_count = 3
        return nearby[:target_count]

    def _should_make_bomb_mistake(self) -> bool:
        mistake_base = max(0.02, (1.0 - self.profile.bomb_avoidance) * 0.5)
        return self.rng.random() < mistake_base

    def _spawn_slice_trail(
        self,
        targets: list[Fruit],
        success: bool,
        bomb: bool = False,
        arena_width: Optional[int] = None,
        arena_height: Optional[int] = None,
    ) -> None:
        if not targets:
            return

        first_target = targets[0]
        last_target = targets[-1]
        direction = pygame.Vector2(last_target.position - first_target.position)
        if direction.length_squared() <= 1:
            direction = pygame.Vector2(1, -0.2)
        direction = direction.normalize()
        normal = pygame.Vector2(-direction.y, direction.x)

        start = first_target.position - (direction * 62) + (normal * 8)
        end = last_target.position + (direction * 62) - (normal * 8)
        if arena_width is not None and arena_height is not None:
            start = pygame.Vector2(
                max(0.0, min(start.x, float(arena_width))),
                max(0.0, min(start.y, float(arena_height))),
            )
            end = pygame.Vector2(
                max(0.0, min(end.x, float(arena_width))),
                max(0.0, min(end.y, float(arena_height))),
            )

        if bomb:
            trail_color = (255, 105, 105)
        elif success:
            trail_color = (70, 170, 255)
        else:
            trail_color = (110, 130, 170)

        self.blade_effect.add_slash(
            start=start,
            end=end,
            color=trail_color,
            width=9 if success else 7,
            duration=0.28 if success else 0.22,
        )

    def _sync_visibility_tracking(
        self,
        now: float,
        objects: list[Fruit],
        arena_width: int,
        arena_height: int,
    ) -> None:
        active_ids = {id(obj) for obj in objects}
        stale_ids = [obj_id for obj_id in self._visible_since if obj_id not in active_ids]
        for obj_id in stale_ids:
            self._visible_since.pop(obj_id, None)
            self._reaction_delay_by_object.pop(obj_id, None)

        for obj in objects:
            obj_id = id(obj)
            fully_visible = self._is_fully_visible(obj, arena_width, arena_height)
            if not fully_visible:
                self._visible_since.pop(obj_id, None)
                self._reaction_delay_by_object.pop(obj_id, None)
                continue

            if obj_id not in self._visible_since:
                self._visible_since[obj_id] = now
                self._reaction_delay_by_object[obj_id] = self.profile.sample_reaction_delay(self.rng)
