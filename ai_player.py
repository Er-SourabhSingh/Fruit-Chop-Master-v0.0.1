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

BOOST_STAGE_MULTIPLIERS = (1, 2, 4, 10)
BOOST_TARGETING_MULTIPLIER = {1: 1.0, 2: 1.25, 4: 1.65, 10: 2.3}
BOOST_COMBO_MULTIPLIER = {1: 1.0, 2: 1.2, 4: 1.45, 10: 1.8}
BOOST_HIT_BONUS = {1: 0.0, 2: 0.03, 4: 0.055, 10: 0.085}
BOOST_MISTAKE_SCALE = {1: 1.0, 2: 0.66, 4: 0.42, 10: 0.18}
MIN_REACTION_DELAY_SECONDS = {"easy": 0.16, "medium": 0.12, "hard": 0.09}
MIN_ACTION_DELAY_SECONDS = {"easy": 0.11, "medium": 0.08, "hard": 0.06}


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
        self._boost_stage = 1

    @property
    def difficulty_level(self) -> str:
        return self._difficulty_level

    @property
    def difficulty_label(self) -> str:
        return self.profile.label

    @property
    def adaptive_stage_label(self) -> str:
        return f"x{self._boost_stage}"

    def set_difficulty(self, difficulty_level: str) -> None:
        self._difficulty_level = difficulty_level.lower()
        self.profile = DifficultyManager.profile_for(self._difficulty_level)

    def reset(self, now: float) -> None:
        self.score = 0
        self.combo_text = ""
        self.combo_timer = 0.0
        self.status_text = ""
        self.status_timer = 0.0
        self._boost_stage = 1
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
        human_score: int,
        human_cut_count: int,
        human_recent_cut_rate: float,
        human_combo_frequency: float,
        human_score_momentum: float,
    ) -> Optional[AIDecision]:
        new_stage = self._build_adaptive_stage(
            round_progress=round_progress,
            human_score=human_score,
            human_cut_count=human_cut_count,
            human_recent_cut_rate=human_recent_cut_rate,
            human_combo_frequency=human_combo_frequency,
            human_score_momentum=human_score_momentum,
        )
        if new_stage > self._boost_stage:
            self.status_text = f"AI Boost x{new_stage}"
            self.status_timer = 0.75
        self._boost_stage = new_stage

        self._sync_visibility_tracking(now, objects, arena_width, arena_height)
        if now < self._next_action_at:
            return None

        reactable_objects = [
            obj
            for obj in objects
            if self._is_fully_visible(obj, arena_width, arena_height) and self._reaction_ready(obj, now)
        ]
        regular_fruits = [obj for obj in reactable_objects if not isinstance(obj, (Bomb, HeartPickup))]
        heart_pickups = [obj for obj in reactable_objects if isinstance(obj, HeartPickup)]
        bombs = [obj for obj in reactable_objects if isinstance(obj, Bomb)]

        if not regular_fruits and not heart_pickups and not bombs:
            self._next_action_at = now + self._action_delay(round_progress, scale=0.45)
            return None

        targeting_multiplier = BOOST_TARGETING_MULTIPLIER[self._boost_stage]
        combo_multiplier = BOOST_COMBO_MULTIPLIER[self._boost_stage]
        hit_bonus = BOOST_HIT_BONUS[self._boost_stage]

        pressure = round_progress * 0.08
        fruit_hit_chance = self.profile.sample_fruit_hit_chance(self.rng)
        fruit_hit_chance = max(0.2, min(0.985, fruit_hit_chance + pressure + hit_bonus))

        combo_chance = self.profile.sample_combo_chance(self.rng)
        combo_chance = max(0.03, min(0.98, (combo_chance + (pressure * 0.9)) * combo_multiplier))

        slicable_targets = [*regular_fruits, *heart_pickups]
        prioritized = self._prioritize_targets(
            candidates=slicable_targets,
            bombs=bombs,
            arena_width=arena_width,
            arena_height=arena_height,
            targeting_multiplier=targeting_multiplier,
        )
        max_combo_targets = 3 if self._boost_stage < 4 else 4 if self._boost_stage < 10 else 5
        targets = self._pick_targets(
            candidates=prioritized,
            combo_chance=combo_chance,
            max_combo_targets=max_combo_targets,
        )
        sliced_targets = []
        for index, target in enumerate(targets):
            primary_boost = 0.02 if index == 0 else 0.0
            if self.rng.random() < min(0.99, fruit_hit_chance + primary_boost):
                sliced_targets.append(target)

        # Recovery slice keeps AI pressure consistent without requiring perfect RNG.
        if not sliced_targets and targets:
            recovery_chance = 0.20 if self._boost_stage <= 2 else 0.35 if self._boost_stage == 4 else 0.52
            if self.rng.random() < recovery_chance:
                sliced_targets.append(targets[0])

        scored_targets = [target for target in sliced_targets if not isinstance(target, HeartPickup)]

        combo_bonus = 0
        points_gained = 0
        if scored_targets:
            # In AI mode, score ownership is one point per fruit. Combo text is visual only.
            points_gained = len(scored_targets)
            if len(scored_targets) > 1:
                combo_bonus = ScoreManager.combo_bonus_for_hits(len(scored_targets))
                self.combo_text = f"AI Combo x{len(scored_targets)}"
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

        self._next_action_at = now + self._action_delay(round_progress, scale=1.0)
        if not sliced_targets and bomb_target is None:
            self._next_action_at = now + self._action_delay(round_progress, scale=0.65)

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

    def _build_adaptive_stage(
        self,
        round_progress: float,
        human_score: int,
        human_cut_count: int,
        human_recent_cut_rate: float,
        human_combo_frequency: float,
        human_score_momentum: float,
    ) -> int:
        expected_cut_rate = 0.95
        expected_combo_rate = 0.10
        expected_momentum = 1.0
        difficulty_scale = 0.85
        if self._difficulty_level == "medium":
            expected_cut_rate = 1.15
            expected_combo_rate = 0.16
            expected_momentum = 1.25
            difficulty_scale = 1.0
        elif self._difficulty_level == "hard":
            expected_cut_rate = 1.35
            expected_combo_rate = 0.22
            expected_momentum = 1.45
            difficulty_scale = 1.2

        cut_ratio = max(0.0, min(10.0, human_recent_cut_rate / max(0.01, expected_cut_rate)))
        combo_ratio = max(0.0, min(10.0, human_combo_frequency / max(0.01, expected_combo_rate)))
        momentum_ratio = max(0.0, min(10.0, human_score_momentum / max(0.01, expected_momentum)))

        elapsed_seconds = max(1.0, round_progress * 60.0)
        expected_total_cuts = max(1.0, expected_cut_rate * elapsed_seconds)
        total_cut_ratio = max(0.0, min(10.0, human_cut_count / expected_total_cuts))

        lead_margin = human_score - self.score
        lead_active = human_score >= self.score
        lead_pressure = 1.0 if lead_active else 0.0
        if lead_margin > 0:
            lead_pressure += min(2.0, lead_margin * 0.22)

        pressure = (
            cut_ratio * 0.34
            + momentum_ratio * 0.27
            + combo_ratio * 0.16
            + total_cut_ratio * 0.12
            + lead_pressure
            + (round_progress * 0.22)
        ) * difficulty_scale

        stage = 1
        if lead_active or cut_ratio >= 2.0 or momentum_ratio >= 2.0 or pressure >= 2.1:
            stage = 2
        if lead_margin >= 4 or cut_ratio >= 3.8 or momentum_ratio >= 3.6 or pressure >= 4.3:
            stage = 4
        if (
            lead_margin >= 7
            or cut_ratio >= 6.5
            or momentum_ratio >= 6.0
            or pressure >= 6.8
            or (lead_active and max(cut_ratio, momentum_ratio) >= 4.8)
        ):
            stage = 10

        # Hard mode gets a stronger immediate catch-up response than other modes.
        if self._difficulty_level == "hard" and lead_active:
            stage = max(stage, 4)

        if stage not in BOOST_STAGE_MULTIPLIERS:
            return 1
        return stage

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

        hard_bonus = 1.08 if self._difficulty_level == "hard" else 1.0
        minimum_delay = MIN_REACTION_DELAY_SECONDS.get(self._difficulty_level, 0.1)
        effective_delay = max(minimum_delay, reaction_delay / (self._boost_stage * hard_bonus))
        return (now - visible_since) >= effective_delay

    def _action_delay(self, round_progress: float, scale: float) -> float:
        base_delay = self.profile.sample_reaction_delay(self.rng)
        progress_bonus = 1.0 - (round_progress * 0.16)
        hard_bonus = 0.86 if self._difficulty_level == "hard" else 0.94 if self._difficulty_level == "medium" else 1.0
        minimum_delay = MIN_ACTION_DELAY_SECONDS.get(self._difficulty_level, 0.08)
        return max(minimum_delay, (base_delay * scale * progress_bonus * hard_bonus) / self._boost_stage)

    def _prioritize_targets(
        self,
        candidates: list[Fruit],
        bombs: list[Bomb],
        arena_width: int,
        arena_height: int,
        targeting_multiplier: float,
    ) -> list[Fruit]:
        if not candidates:
            return []

        center_x = arena_width * 0.5
        sorted_candidates = sorted(
            candidates,
            key=lambda fruit: self._fruit_priority_score(
                fruit,
                bombs=bombs,
                arena_height=arena_height,
                center_x=center_x,
                arena_width=arena_width,
                targeting_multiplier=targeting_multiplier,
            ),
            reverse=True,
        )
        return sorted_candidates

    def _fruit_priority_score(
        self,
        fruit: Fruit,
        bombs: list[Bomb],
        arena_height: int,
        center_x: float,
        arena_width: int,
        targeting_multiplier: float,
    ) -> float:
        urgency = self._object_urgency_score(fruit, arena_height)
        center_penalty = abs(fruit.position.x - center_x) / max(1.0, float(arena_width))
        risky_penalty = 1.0 if self._is_risky_near_bomb(fruit, bombs) else 0.0
        return (urgency * targeting_multiplier) - (center_penalty * 0.24) - (risky_penalty * 0.95)

    @staticmethod
    def _object_urgency_score(obj: Fruit, arena_height: int) -> float:
        time_to_exit = AIPlayer._estimate_time_to_bottom_exit(obj, arena_height)
        urgency = 1.0 / (0.11 + time_to_exit)
        descent_bonus = max(0.0, obj.vel.y / 900.0) * 0.58
        return urgency + descent_bonus

    @staticmethod
    def _estimate_time_to_bottom_exit(obj: Fruit, arena_height: int) -> float:
        distance = max(0.0, (arena_height + obj.radius) - obj.position.y)
        if obj.vel.y > 0:
            return distance / max(55.0, obj.vel.y)
        return 1.8 + (abs(obj.vel.y) / 540.0)

    def _is_risky_near_bomb(self, target: Fruit, bombs: list[Bomb]) -> bool:
        if not bombs:
            return False

        safety_buffer = 44 if self._difficulty_level == "hard" else 32 if self._difficulty_level == "medium" else 22
        for bomb in bombs:
            min_safe_distance = target.radius + bomb.radius + safety_buffer
            if target.position.distance_squared_to(bomb.position) <= min_safe_distance * min_safe_distance:
                return True
        return False

    def _pick_targets(self, candidates: list[Fruit], combo_chance: float, max_combo_targets: int) -> list[Fruit]:
        if not candidates:
            return []

        if len(candidates) == 1:
            return [candidates[0]]

        if self.rng.random() >= combo_chance:
            return [candidates[0]]

        seed = candidates[0]
        nearby = sorted(candidates, key=lambda fruit: seed.position.distance_squared_to(fruit.position))

        target_count = 2
        if max_combo_targets >= 3 and len(nearby) >= 3 and self.rng.random() < combo_chance * 0.86:
            target_count = 3
        if max_combo_targets >= 4 and len(nearby) >= 4 and self.rng.random() < combo_chance * 0.54:
            target_count = 4
        if max_combo_targets >= 5 and len(nearby) >= 5 and self.rng.random() < combo_chance * 0.36:
            target_count = 5
        return nearby[: min(target_count, len(nearby))]

    def _should_make_bomb_mistake(self) -> bool:
        mistake_base = max(0.0015, (1.0 - self.profile.bomb_avoidance) * 0.28)
        mistake_scale = BOOST_MISTAKE_SCALE[self._boost_stage]
        return self.rng.random() < (mistake_base * mistake_scale)

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
