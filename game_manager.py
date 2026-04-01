from __future__ import annotations

import json
import random
from dataclasses import dataclass
from math import sqrt
from pathlib import Path
from typing import Optional

import pygame

from ai_player import AIPlayer
from asset_loader import AssetLoader
from blade import Blade
from bomb import Bomb
from difficulty_manager import DifficultyManager
from fruit import FRUIT_TYPES, Fruit
from heart_pickup import HeartPickup
from human_player import HumanPlayer
from result_screen import ResultScreen, ResultScreenModel
from score_manager import ScoreManager

SCREEN_WIDTH = 1280
SCREEN_HEIGHT = 720
FPS = 60
STARTING_LIVES = 3
MAX_LIVES = 5
SKIPS_PER_LIFE_LOSS = 5

MODE_CLASSIC = "classic"
MODE_AI_VS_HUMAN = "ai_vs_human"

AI_VS_HUMAN_ROUND_SECONDS = 60.0
AI_BOMB_PENALTY = 2


@dataclass
class JuiceParticle:
    pos: pygame.Vector2
    vel: pygame.Vector2
    radius: float
    life: float
    max_life: float
    color: tuple[int, int, int]


class GameManager:
    def __init__(self, screen: pygame.Surface) -> None:
        self.screen = screen
        self.width, self.height = self.screen.get_size()
        self.state = "start"
        self.base_path = Path(__file__).resolve().parent

        self.asset_loader = AssetLoader(self.base_path / "assets")
        self.asset_loader.ensure_directories()
        self.images = self._load_images()
        self.sounds = self._load_sounds()

        self.background_source = self.images.get("background")
        self.background: Optional[pygame.Surface] = None
        self.fallback_background = self._build_fallback_background()
        self.effect_surface = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        self._refresh_background()

        self.title_font = pygame.font.Font(None, 96)
        self.heading_font = pygame.font.Font(None, 64)
        self.ui_font = pygame.font.Font(None, 40)
        self.body_font = pygame.font.Font(None, 36)
        self._update_fonts()

        self.selected_mode = MODE_CLASSIC
        self.active_mode = MODE_CLASSIC
        self.selected_ai_difficulty = DifficultyManager.DEFAULT_LEVEL
        self.round_time_remaining = AI_VS_HUMAN_ROUND_SECONDS
        self.elapsed_time = 0.0

        self.blade = Blade()
        self.human_player = HumanPlayer(score=0, lives=STARTING_LIVES)
        self.ai_player = AIPlayer(difficulty_level=self.selected_ai_difficulty)
        self.result_screen = ResultScreen()
        self.result_model: Optional[ResultScreenModel] = None
        self._active_touch_id: Optional[int] = None
        self._touch_active = False
        self._touch_position = pygame.Vector2(self.width * 0.5, self.height * 0.5)

        self.objects: list[Fruit] = []
        self.particles: list[JuiceParticle] = []
        self.spawn_cooldown = 0.0
        self.heart_spawn_cooldown = random.uniform(4.5, 7.0)
        self.spawn_interval = 0.9
        self.speed_multiplier = 1.0
        self.blast_center = pygame.Vector2(self.width * 0.5, self.height * 0.5)
        self.blast_timer = 0.0
        self.blast_duration = 0.5
        self.pending_game_over_reason = ""
        self.game_over_reason = ""

        self.high_score_file = self.base_path / "data" / "highscore.json"
        self.high_score = self._load_high_score()
        self.new_high_score_achieved = False

        self.menu_mode_rects: dict[str, pygame.Rect] = {
            MODE_CLASSIC: pygame.Rect(0, 0, 0, 0),
            MODE_AI_VS_HUMAN: pygame.Rect(0, 0, 0, 0),
        }
        self.menu_difficulty_rects: dict[str, pygame.Rect] = {}
        self.menu_start_rect = pygame.Rect(0, 0, 0, 0)
        self._update_menu_layout()

    def resize(self, screen: pygame.Surface) -> None:
        old_width, old_height = self.width, self.height
        self.screen = screen
        self.width, self.height = self.screen.get_size()

        if old_width > 0 and old_height > 0:
            scale_x = self.width / old_width
            scale_y = self.height / old_height
            self._rescale_runtime_objects(scale_x, scale_y)

        self.effect_surface = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        self.fallback_background = self._build_fallback_background()
        self._refresh_background()
        self._update_fonts()
        self._update_menu_layout()
        self._touch_position = self._clamp_to_screen(self._touch_position)

    def handle_events(self, events: list[pygame.event.Event]) -> None:
        for event in events:
            self._handle_pointer_event(event)

            if self.state == "start":
                self._handle_start_event(event)
                continue

            if self.state == "game_over":
                self._handle_game_over_event(event)
                continue

            if self.state == "running" and event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                self.back_to_menu()

    def _handle_start_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.KEYDOWN:
            if event.key in (pygame.K_1, pygame.K_KP1):
                self.selected_mode = MODE_CLASSIC
            elif event.key in (pygame.K_2, pygame.K_KP2):
                self.selected_mode = MODE_AI_VS_HUMAN
            elif event.key in (pygame.K_LEFT, pygame.K_RIGHT):
                self.selected_mode = MODE_AI_VS_HUMAN if self.selected_mode == MODE_CLASSIC else MODE_CLASSIC
            elif self.selected_mode == MODE_AI_VS_HUMAN and event.key in (pygame.K_UP, pygame.K_DOWN):
                step = -1 if event.key == pygame.K_UP else 1
                self.selected_ai_difficulty = DifficultyManager.cycle_level(self.selected_ai_difficulty, step)
            elif self.selected_mode == MODE_AI_VS_HUMAN and event.key in (pygame.K_q, pygame.K_w, pygame.K_e):
                if event.key == pygame.K_q:
                    self.selected_ai_difficulty = "easy"
                elif event.key == pygame.K_w:
                    self.selected_ai_difficulty = "medium"
                else:
                    self.selected_ai_difficulty = "hard"
            elif event.key in (pygame.K_RETURN, pygame.K_SPACE):
                self.start_game()
            return

        click_pos: Optional[tuple[int, int]] = None
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            click_pos = event.pos
        elif event.type == pygame.FINGERDOWN:
            click_pos = self._finger_to_surface_coords(event.x, event.y, clamp=True)

        if click_pos is not None:
            self._update_menu_layout()
            if self.menu_mode_rects[MODE_CLASSIC].collidepoint(click_pos):
                self.selected_mode = MODE_CLASSIC
                return

            if self.menu_mode_rects[MODE_AI_VS_HUMAN].collidepoint(click_pos):
                self.selected_mode = MODE_AI_VS_HUMAN
                return

            for level, rect in self.menu_difficulty_rects.items():
                if rect.collidepoint(click_pos):
                    self.selected_mode = MODE_AI_VS_HUMAN
                    self.selected_ai_difficulty = level
                    return

            if self.menu_start_rect.collidepoint(click_pos):
                self.start_game()

    def _handle_game_over_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.KEYDOWN:
            if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                self.start_game()
                return

            if event.key in (pygame.K_m, pygame.K_BACKSPACE, pygame.K_ESCAPE):
                self.back_to_menu()
                return

        click_pos: Optional[tuple[int, int]] = None
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            click_pos = event.pos
        elif event.type == pygame.FINGERDOWN:
            click_pos = self._finger_to_surface_coords(event.x, event.y, clamp=True)

        if click_pos is not None:
            action = self.result_screen.clicked_action(click_pos)
            if action == "restart":
                self.start_game()
            elif action == "menu":
                self.back_to_menu()

    def start_game(self) -> None:
        self.active_mode = self.selected_mode
        self.state = "running"
        self.result_model = None
        self.pending_game_over_reason = ""
        self.game_over_reason = ""

        self.human_player.reset(starting_lives=STARTING_LIVES)
        self.elapsed_time = 0.0
        self.spawn_cooldown = 0.35
        self.heart_spawn_cooldown = random.uniform(4.5, 7.0)
        self.spawn_interval = 0.9
        self.speed_multiplier = 1.0
        self.blast_timer = 0.0
        self.new_high_score_achieved = False
        self.objects.clear()
        self.particles.clear()
        self.blade.reset()

        now = pygame.time.get_ticks() / 1000.0
        self.ai_player.set_difficulty(self.selected_ai_difficulty)
        self.ai_player.reset(now=now)
        self.round_time_remaining = AI_VS_HUMAN_ROUND_SECONDS

    def back_to_menu(self) -> None:
        self.state = "start"
        self.selected_mode = self.active_mode
        self.objects.clear()
        self.particles.clear()
        self.blade.reset()
        self.pending_game_over_reason = ""
        self.game_over_reason = ""
        self.result_model = None
        self._touch_active = False
        self._active_touch_id = None
        self._update_menu_layout()

    def update(self, dt: float) -> None:
        now = pygame.time.get_ticks() / 1000.0
        pointer_pos, pointer_pressed = self._current_pointer_input()
        self.blade.update(
            pointer_pos=pointer_pos,
            pointer_pressed=pointer_pressed,
            now=now,
            bounds=self._screen_bounds(),
        )

        self._update_particles(dt)
        self.human_player.update_timers(dt)
        self.ai_player.update_timers(dt)

        if self.state == "bomb_blast":
            self._update_bomb_blast(dt)
            return

        if self.state != "running":
            return

        if self.active_mode == MODE_AI_VS_HUMAN:
            self.round_time_remaining = max(0.0, self.round_time_remaining - dt)
            if self.round_time_remaining <= 0.0:
                self._trigger_game_over("time_up")
                return

        self._update_difficulty(dt)
        self._handle_spawning(dt)

        for obj in self.objects:
            obj.update(dt)
            obj.constrain_horizontal(self.width)

        self._handle_slicing()
        if self.state != "running":
            return

        if self.active_mode == MODE_AI_VS_HUMAN:
            self._handle_ai_turn(now)
        if self.state != "running":
            return

        self._handle_missed_objects()
        if self.state != "running":
            return

        self._handle_human_combo_bonus()

    def draw(self) -> None:
        self._draw_background()
        self._draw_particles()

        if self.state == "start":
            self._draw_start_screen()
            self.blade.draw(self.screen, bounds=self._screen_bounds())
            return

        if self.state == "running":
            for obj in self.objects:
                obj.draw(self.screen)

            if self.active_mode == MODE_AI_VS_HUMAN:
                self.ai_player.draw(self.screen)

            self.blade.draw(self.screen, bounds=self._screen_bounds())
            self._draw_hud()
            self._draw_combo_texts()
            return

        if self.state == "bomb_blast":
            self._draw_hud()
            self._draw_bomb_blast_effect()
            return

        self._draw_game_over_screen()
        self.blade.draw(self.screen, bounds=self._screen_bounds())

    def _update_difficulty(self, dt: float) -> None:
        self.elapsed_time += dt
        progress_score = self._difficulty_progress_score()

        if progress_score <= 20:
            target_speed = 1.0
            target_interval = 0.9
        elif progress_score <= 50:
            mid_progress = (progress_score - 20) / 30.0
            target_speed = 1.0 + (0.28 * mid_progress)
            target_interval = 0.9 - (0.13 * mid_progress)
        else:
            high_progress = progress_score - 50
            target_speed = min(1.85, 1.28 + (high_progress * 0.008))
            target_interval = max(0.34, 0.77 - (high_progress * 0.0025))

        # Smooth interpolation avoids abrupt speed jumps at score thresholds.
        smoothing = min(1.0, dt * 4.0)
        self.speed_multiplier += (target_speed - self.speed_multiplier) * smoothing
        self.spawn_interval += (target_interval - self.spawn_interval) * smoothing

    def _handle_spawning(self, dt: float) -> None:
        self.heart_spawn_cooldown = max(0.0, self.heart_spawn_cooldown - dt)
        self.spawn_cooldown -= dt
        if self.spawn_cooldown > 0:
            return

        self._spawn_wave()
        interval_variation = random.uniform(0.85, 1.15)
        self.spawn_cooldown = self.spawn_interval * interval_variation

    def _spawn_wave(self) -> None:
        progress_score = self._difficulty_progress_score()
        difficulty = min(1.0, progress_score / 85.0)
        object_count = 1

        if random.random() < 0.45 + (difficulty * 0.35):
            object_count += 1
        if random.random() < 0.15 + (difficulty * 0.30):
            object_count += 1

        for _ in range(object_count):
            self._spawn_object()

    def _spawn_object(self) -> None:
        x_pos = self.width * 0.5
        y_pos = self.height + max(55, int(self.height * 0.1))

        vx, vy, gravity, scale = self._build_launch_profile()
        if self._should_spawn_heart():
            self._spawn_heart(position=(x_pos, y_pos), velocity=(vx, vy), gravity=gravity, scale=scale)
            return

        progress_score = self._difficulty_progress_score()
        bomb_chance = min(0.24, 0.10 + (progress_score * 0.0018))
        if random.random() < bomb_chance:
            self._spawn_bomb(position=(x_pos, y_pos), velocity=(vx, vy), gravity=gravity, scale=scale)
            return

        self._spawn_fruit(position=(x_pos, y_pos), velocity=(vx, vy), gravity=gravity, scale=scale)

    def _build_launch_profile(self) -> tuple[float, float, float, float]:
        # Scale movement by window height to keep relative game feel stable.
        motion_scale = max(0.75, min(1.7, self.height / SCREEN_HEIGHT))
        difficulty_scale = 1.0 + ((self.speed_multiplier - 1.0) * 0.9)

        # 30% to 108% of screen-height rise gives low/mid/high arcs.
        rise_ratio = random.uniform(0.30, 1.08)
        rise_distance = self.height * rise_ratio

        gravity = random.uniform(820, 1120) * motion_scale * difficulty_scale
        vy = -sqrt(max(1.0, 2.0 * gravity * rise_distance))
        vy *= random.uniform(0.97, 1.05)

        # Horizontal spread is intentionally limited to avoid off-screen side exits.
        horizontal_range = max(85.0, self.width * 0.11) * motion_scale
        horizontal_boost = 1.0 + ((self.speed_multiplier - 1.0) * 0.35)
        vx = random.uniform(-horizontal_range, horizontal_range) * horizontal_boost

        size_scale = max(0.72, min(1.35, min(self.width / SCREEN_WIDTH, self.height / SCREEN_HEIGHT)))
        scale = random.uniform(0.78, 1.08) * size_scale
        return vx, vy, gravity, scale

    def _should_spawn_heart(self) -> bool:
        if self.heart_spawn_cooldown > 0.0:
            return False

        if random.random() >= 0.03:
            return False

        self.heart_spawn_cooldown = random.uniform(7.0, 12.0)
        return True

    def _spawn_fruit(
        self,
        position: tuple[float, float],
        velocity: tuple[float, float],
        gravity: float,
        scale: float,
    ) -> None:
        fruit_name = random.choice(FRUIT_TYPES)
        fruit = Fruit(
            name=fruit_name,
            position=position,
            velocity=velocity,
            gravity=gravity,
            image=self.images.get(fruit_name),
            scale=scale,
        )
        fruit.position.x = self._random_spawn_x(fruit.radius)
        self.objects.append(fruit)

    def _spawn_bomb(
        self,
        position: tuple[float, float],
        velocity: tuple[float, float],
        gravity: float,
        scale: float,
    ) -> None:
        bomb = Bomb(
            position=position,
            velocity=velocity,
            gravity=gravity,
            image=self.images.get("bomb"),
            scale=scale,
        )
        bomb.position.x = self._random_spawn_x(bomb.radius)
        self.objects.append(bomb)

    def _spawn_heart(
        self,
        position: tuple[float, float],
        velocity: tuple[float, float],
        gravity: float,
        scale: float,
    ) -> None:
        heart = HeartPickup(
            position=position,
            velocity=velocity,
            gravity=gravity,
            image=self.images.get("heart"),
            scale=scale,
        )
        heart.position.x = self._random_spawn_x(heart.radius)
        self.objects.append(heart)

    def _handle_slicing(self) -> None:
        segments = self.blade.get_segments(bounds=self._screen_bounds())
        if not segments:
            return

        survivors: list[Fruit] = []
        for obj in self.objects:
            if self._hit_by_blade(obj, segments):
                if isinstance(obj, Bomb):
                    self._handle_bomb_hit(obj)
                    if self.state != "running":
                        return
                    continue

                if isinstance(obj, HeartPickup):
                    self._collect_heart(obj)
                    continue

                self._slice_fruit(obj)
                continue

            survivors.append(obj)

        self.objects = survivors

    def _handle_ai_turn(self, now: float) -> None:
        decision = self.ai_player.decide_action(
            now=now,
            objects=self.objects,
            arena_width=self.width,
            arena_height=self.height,
            round_progress=self._round_progress(),
        )
        if decision is None:
            return

        removed: set[Fruit] = set()
        for target in decision.sliced_targets:
            target.slice()
            removed.add(target)
            self._spawn_juice_splash(target.position, (98, 170, 255))

        if decision.sliced_targets:
            self._play_sound("slice")
            if decision.combo_bonus > 0:
                self._play_sound("combo")

        if decision.bomb_target is not None:
            decision.bomb_target.slice()
            removed.add(decision.bomb_target)
            self._handle_ai_bomb_hit(decision.bomb_target)

        if removed:
            self.objects = [obj for obj in self.objects if obj not in removed]

    def _handle_ai_bomb_hit(self, bomb: Bomb) -> None:
        self.ai_player.apply_bomb_penalty(AI_BOMB_PENALTY)
        for _ in range(2):
            self._spawn_juice_splash(bomb.position, (255, 112, 112))

    def _handle_missed_objects(self) -> None:
        remaining: list[Fruit] = []
        for obj in self.objects:
            if obj.off_screen(self.height):
                if self._is_regular_fruit(obj):
                    self._apply_missed_fruit_penalty()
                    if self.state != "running":
                        return
                continue

            remaining.append(obj)

        self.objects = remaining

    def _slice_fruit(self, fruit: Fruit) -> None:
        fruit.slice()
        self.human_player.score += 1
        self.blade.register_slice()
        self._spawn_juice_splash(fruit.position, fruit.color)
        self._play_sound("slice")

    def _collect_heart(self, heart: HeartPickup) -> None:
        heart.slice()
        if self.human_player.lives < MAX_LIVES:
            self.human_player.lives += 1

        self._spawn_juice_splash(heart.position, heart.color)
        self._play_sound("slice")

    def _handle_bomb_hit(self, bomb: Bomb) -> None:
        bomb.slice()
        self._trigger_bomb_blast(bomb.position, reason="human_bomb")

    def _apply_missed_fruit_penalty(self) -> None:
        life_loss_triggered = self.human_player.register_missed_fruit(SKIPS_PER_LIFE_LOSS)
        if life_loss_triggered:
            self._apply_life_loss()

    def _apply_life_loss(self) -> None:
        out_of_lives = self.human_player.lose_life()
        if not out_of_lives:
            return

        if self.active_mode == MODE_AI_VS_HUMAN:
            self._trigger_game_over("human_out_of_lives")
        else:
            self._trigger_game_over("classic_lives_depleted")

    @staticmethod
    def _is_regular_fruit(obj: Fruit) -> bool:
        return not isinstance(obj, (Bomb, HeartPickup))

    def _trigger_game_over(self, reason: str) -> None:
        if self.state == "game_over":
            return

        self.game_over_reason = reason
        self._finalize_high_score()
        self.state = "game_over"
        self.objects.clear()
        self.blade.reset()
        self.pending_game_over_reason = ""
        self.result_model = self._build_result_model(reason)

    def _build_result_model(self, reason: str) -> ResultScreenModel:
        if self.active_mode == MODE_AI_VS_HUMAN:
            if reason == "human_bomb":
                outcome_text = "AI Wins! Bomb Hit"
                winner = "ai"
            elif reason == "human_out_of_lives":
                outcome_text = "AI Wins! Out Of Lives"
                winner = "ai"
            elif self.human_player.score > self.ai_player.score:
                outcome_text = "You Win!"
                winner = "human"
            elif self.human_player.score < self.ai_player.score:
                outcome_text = "AI Wins!"
                winner = "ai"
            else:
                outcome_text = "Draw!"
                winner = "draw"

            return ResultScreenModel(
                mode_label=f"Mode: AI vs Human ({self.ai_player.difficulty_label})",
                title="Match Over",
                outcome_text=outcome_text,
                winner=winner,
                human_score=self.human_player.score,
                ai_score=self.ai_player.score,
                high_score=self.high_score,
                new_high_score=self.new_high_score_achieved,
            )

        return ResultScreenModel(
            mode_label="Mode: Classic",
            title="Game Over",
            outcome_text="Try Again!",
            winner="none",
            human_score=self.human_player.score,
            ai_score=None,
            high_score=self.high_score,
            new_high_score=self.new_high_score_achieved,
        )

    def _finalize_high_score(self) -> None:
        if self.human_player.score > self.high_score:
            self.high_score = self.human_player.score
            self.new_high_score_achieved = True
            self._save_high_score(self.high_score)
            return

        self.new_high_score_achieved = False

    def _load_high_score(self) -> int:
        self.high_score_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.high_score_file.exists():
            self._save_high_score(0)
            return 0

        try:
            raw_data = self.high_score_file.read_text(encoding="utf-8")
            parsed = json.loads(raw_data)
            value = parsed.get("high_score", 0)
            if isinstance(value, bool):
                raise ValueError
            if not isinstance(value, int) or value < 0:
                raise ValueError
            return value
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            self._save_high_score(0)
            return 0

    def _save_high_score(self, score: int) -> None:
        safe_score = max(0, int(score))
        payload = {"high_score": safe_score}
        try:
            self.high_score_file.parent.mkdir(parents=True, exist_ok=True)
            json_text = json.dumps(payload, indent=2)
            self.high_score_file.write_text(json_text, encoding="utf-8")
        except OSError:
            # High score persistence failure should never crash gameplay.
            return

    def _trigger_bomb_blast(self, position: pygame.Vector2, reason: str) -> None:
        self.state = "bomb_blast"
        self.pending_game_over_reason = reason
        self.blast_center = position.copy()
        self.blast_timer = self.blast_duration
        self.objects.clear()
        self.blade.reset()
        self._play_sound("bomb")

        for _ in range(3):
            self._spawn_juice_splash(position, (255, 88, 72))

    def _handle_human_combo_bonus(self) -> None:
        sliced_in_swipe = self.blade.consume_combo_hits()
        if sliced_in_swipe <= 1:
            return

        bonus = ScoreManager.combo_bonus_for_hits(sliced_in_swipe)
        self.human_player.score += bonus
        self.human_player.combo_text = ScoreManager.human_combo_text(sliced_in_swipe, bonus)
        self.human_player.combo_timer = 1.0
        self._play_sound("combo")

    def _update_bomb_blast(self, dt: float) -> None:
        self.blast_timer = max(0.0, self.blast_timer - dt)
        if self.blast_timer <= 0.0:
            reason = self.pending_game_over_reason or "bomb_blast"
            self._trigger_game_over(reason)

    def _update_particles(self, dt: float) -> None:
        alive_particles: list[JuiceParticle] = []
        for particle in self.particles:
            particle.life -= dt
            if particle.life <= 0:
                continue

            particle.vel.y += 700 * dt
            particle.pos += particle.vel * dt
            particle.radius = max(0.4, particle.radius - (dt * 13))
            alive_particles.append(particle)

        self.particles = alive_particles

    def _spawn_juice_splash(self, pos: pygame.Vector2, color: tuple[int, int, int]) -> None:
        count = random.randint(13, 20)
        for _ in range(count):
            velocity = pygame.Vector2(random.uniform(-260, 260), random.uniform(-360, 10))
            life = random.uniform(0.35, 0.6)
            radius = random.uniform(3.0, 7.0)
            self.particles.append(
                JuiceParticle(
                    pos=pos.copy(),
                    vel=velocity,
                    radius=radius,
                    life=life,
                    max_life=life,
                    color=color,
                )
            )

    def _draw_particles(self) -> None:
        if not self.particles:
            return

        self.effect_surface.fill((0, 0, 0, 0))
        for particle in self.particles:
            alpha = int(255 * (particle.life / particle.max_life))
            draw_color = (*particle.color, max(0, min(255, alpha)))
            pygame.draw.circle(
                self.effect_surface,
                draw_color,
                (int(particle.pos.x), int(particle.pos.y)),
                max(1, int(particle.radius)),
            )

        self.screen.blit(self.effect_surface, (0, 0))

    @staticmethod
    def _hit_by_blade(obj: Fruit, segments: list[tuple[pygame.Vector2, pygame.Vector2]]) -> bool:
        for seg_start, seg_end in segments:
            if GameManager._line_circle_collision(seg_start, seg_end, obj.position, obj.collision_radius):
                return True
        return False

    @staticmethod
    def _line_circle_collision(
        seg_start: pygame.Vector2,
        seg_end: pygame.Vector2,
        center: pygame.Vector2,
        radius: float,
    ) -> bool:
        segment = seg_end - seg_start
        segment_length_sq = segment.length_squared()

        if segment_length_sq == 0:
            return seg_start.distance_squared_to(center) <= (radius * radius)

        projection = (center - seg_start).dot(segment) / segment_length_sq
        projection = max(0.0, min(1.0, projection))
        closest_point = seg_start + (segment * projection)
        return closest_point.distance_squared_to(center) <= (radius * radius)

    def _draw_background(self) -> None:
        if self.background is not None:
            self.screen.blit(self.background, (0, 0))
            return
        self.screen.blit(self.fallback_background, (0, 0))

    def _draw_hud(self) -> None:
        if self.active_mode == MODE_AI_VS_HUMAN:
            self._draw_ai_hud()
        else:
            self._draw_classic_hud()

    def _draw_classic_hud(self) -> None:
        padding_x = max(16, int(self.width * 0.016))
        padding_y = max(14, int(self.height * 0.02))

        score_surface = self.ui_font.render(f"Score: {self.human_player.score}", True, (245, 245, 245))
        self.screen.blit(score_surface, (padding_x, padding_y))

        hearts = " ".join("\u2764" for _ in range(max(0, self.human_player.lives)))
        if not hearts:
            hearts = "0"
        lives_surface = self.ui_font.render(f"Lives: {hearts}", True, (255, 92, 92))
        lives_rect = lives_surface.get_rect(midtop=(self.width // 2, padding_y))
        self.screen.blit(lives_surface, lives_rect)

        skipped_surface = self.ui_font.render(
            f"Skipped: {self.human_player.skipped_fruits}/{SKIPS_PER_LIFE_LOSS}",
            True,
            (245, 225, 225),
        )
        skipped_rect = skipped_surface.get_rect(topright=(self.width - padding_x, padding_y))
        self.screen.blit(skipped_surface, skipped_rect)

    def _draw_ai_hud(self) -> None:
        bar_height = max(82, int(self.height * 0.145))
        hud_overlay = pygame.Surface((self.width, bar_height), pygame.SRCALPHA)
        hud_overlay.fill((8, 12, 20, 135))
        self.screen.blit(hud_overlay, (0, 0))

        padding_x = max(20, int(self.width * 0.02))
        top_y = max(8, int(self.height * 0.014))

        human_surface = self.ui_font.render(f"Human: {self.human_player.score}", True, (255, 236, 125))
        self.screen.blit(human_surface, (padding_x, top_y))

        ai_surface = self.ui_font.render(f"AI: {self.ai_player.score}", True, (130, 205, 255))
        ai_rect = ai_surface.get_rect(topright=(self.width - padding_x, top_y))
        self.screen.blit(ai_surface, ai_rect)

        timer_surface = self.heading_font.render(self._format_timer(self.round_time_remaining), True, (245, 245, 245))
        timer_rect = timer_surface.get_rect(midtop=(self.width // 2, top_y - 1))
        self.screen.blit(timer_surface, timer_rect)

        mode_surface = self.body_font.render("Mode: AI vs Human", True, (220, 232, 252))
        mode_rect = mode_surface.get_rect(midtop=(self.width // 2, timer_rect.bottom - 2))
        self.screen.blit(mode_surface, mode_rect)

        hearts = " ".join("\u2764" for _ in range(max(0, self.human_player.lives)))
        if not hearts:
            hearts = "0"
        lives_surface = self.body_font.render(f"Lives: {hearts}", True, (255, 106, 106))
        self.screen.blit(lives_surface, (padding_x, human_surface.get_rect().height + top_y + 2))

        difficulty_surface = self.body_font.render(f"AI: {self.ai_player.difficulty_label}", True, (170, 212, 255))
        difficulty_rect = difficulty_surface.get_rect(topright=(self.width - padding_x, ai_rect.bottom + 2))
        self.screen.blit(difficulty_surface, difficulty_rect)

    def _draw_bomb_blast_effect(self) -> None:
        if self.blast_timer <= 0.0:
            return

        progress = 1.0 - (self.blast_timer / self.blast_duration)
        progress = max(0.0, min(1.0, progress))

        shake_strength = int((1.0 - progress) * 22)
        center = pygame.Vector2(self.blast_center)
        if shake_strength > 0:
            center.x += random.uniform(-shake_strength, shake_strength)
            center.y += random.uniform(-shake_strength, shake_strength)

        max_radius = int(max(self.width, self.height) * 0.55)
        outer_radius = int(max(24, progress * max_radius))
        core_radius = max(10, int(outer_radius * 0.45))
        ring_radius = max(core_radius + 10, int(outer_radius * 1.18))

        overlay = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        flash_alpha = int(220 * (1.0 - progress))
        overlay.fill((255, 235, 210, max(0, flash_alpha)))

        center_xy = (int(center.x), int(center.y))
        pygame.draw.circle(overlay, (255, 145, 82, 180), center_xy, outer_radius)
        pygame.draw.circle(overlay, (255, 88, 72, 210), center_xy, core_radius)
        pygame.draw.circle(
            overlay,
            (255, 240, 220, 205),
            center_xy,
            ring_radius,
            width=max(2, int(8 * (1.0 - progress))),
        )
        self.screen.blit(overlay, (0, 0))

    def _draw_combo_texts(self) -> None:
        if self.human_player.combo_timer > 0.0 and self.human_player.combo_text:
            alpha = int(255 * min(1.0, self.human_player.combo_timer / 1.0))
            text_surface = self.heading_font.render(self.human_player.combo_text, True, (255, 220, 120))
            text_surface.set_alpha(alpha)
            text_rect = text_surface.get_rect(center=(self.width // 2, max(56, int(self.height * 0.12))))
            self.screen.blit(text_surface, text_rect)

        if self.active_mode != MODE_AI_VS_HUMAN:
            return

        if self.ai_player.combo_timer > 0.0 and self.ai_player.combo_text:
            alpha = int(255 * min(1.0, self.ai_player.combo_timer / 1.0))
            ai_combo_surface = self.body_font.render(self.ai_player.combo_text, True, (140, 210, 255))
            ai_combo_surface.set_alpha(alpha)
            ai_combo_rect = ai_combo_surface.get_rect(center=(self.width // 2, max(92, int(self.height * 0.18))))
            self.screen.blit(ai_combo_surface, ai_combo_rect)

        if self.ai_player.status_timer > 0.0 and self.ai_player.status_text:
            alpha = int(255 * min(1.0, self.ai_player.status_timer / 1.0))
            status_surface = self.body_font.render(self.ai_player.status_text, True, (165, 220, 255))
            status_surface.set_alpha(alpha)
            status_rect = status_surface.get_rect(center=(int(self.width * 0.78), max(84, int(self.height * 0.14))))
            self.screen.blit(status_surface, status_rect)

    def _draw_start_screen(self) -> None:
        self._update_menu_layout()

        overlay = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        overlay.fill((8, 12, 20, 124))
        self.screen.blit(overlay, (0, 0))

        title = self.title_font.render("FRUIT SLICE", True, (250, 250, 250))
        subtitle = self.body_font.render("Choose a mode and start slicing", True, (216, 226, 242))
        self.screen.blit(title, title.get_rect(center=(self.width // 2, int(self.height * 0.16))))
        self.screen.blit(subtitle, subtitle.get_rect(center=(self.width // 2, int(self.height * 0.23))))

        self._draw_mode_card(
            self.menu_mode_rects[MODE_CLASSIC],
            title="Classic",
            subtitle="Score chase with lives",
            selected=self.selected_mode == MODE_CLASSIC,
            accent=(255, 178, 102),
        )
        self._draw_mode_card(
            self.menu_mode_rects[MODE_AI_VS_HUMAN],
            title="AI vs Human",
            subtitle="60s competitive duel",
            selected=self.selected_mode == MODE_AI_VS_HUMAN,
            accent=(120, 185, 255),
        )

        chips_title = self.body_font.render("AI Difficulty", True, (210, 226, 248))
        chips_title_rect = chips_title.get_rect(center=(self.width // 2, self.menu_mode_rects[MODE_AI_VS_HUMAN].bottom + 20))
        self.screen.blit(chips_title, chips_title_rect)

        for level in DifficultyManager.LEVEL_ORDER:
            rect = self.menu_difficulty_rects[level]
            selected = self.selected_ai_difficulty == level
            enabled = self.selected_mode == MODE_AI_VS_HUMAN
            self._draw_difficulty_chip(rect, level.title(), selected=selected, enabled=enabled)

        button_color = (58, 170, 95) if self.selected_mode == MODE_CLASSIC else (64, 142, 224)
        pygame.draw.rect(self.screen, button_color, self.menu_start_rect, border_radius=12)
        pygame.draw.rect(self.screen, (242, 242, 242), self.menu_start_rect, width=2, border_radius=12)
        start_label = self.heading_font.render("Start Match", True, (248, 248, 248))
        self.screen.blit(start_label, start_label.get_rect(center=self.menu_start_rect.center))

        hint_line = self.body_font.render(
            "Keys: 1 Classic, 2 AI vs Human, Q/W/E AI Difficulty, Enter to Start",
            True,
            (205, 220, 242),
        )
        hint_rect = hint_line.get_rect(center=(self.width // 2, int(self.height * 0.90)))
        self.screen.blit(hint_line, hint_rect)

    def _draw_mode_card(
        self,
        rect: pygame.Rect,
        title: str,
        subtitle: str,
        selected: bool,
        accent: tuple[int, int, int],
    ) -> None:
        fill_color = (38, 48, 72) if selected else (26, 34, 54)
        border_color = accent if selected else (124, 142, 176)
        pygame.draw.rect(self.screen, fill_color, rect, border_radius=14)
        pygame.draw.rect(self.screen, border_color, rect, width=3 if selected else 2, border_radius=14)

        title_surface = self.ui_font.render(title, True, (246, 246, 246))
        title_rect = title_surface.get_rect(center=(rect.centerx, rect.top + int(rect.height * 0.34)))
        self.screen.blit(title_surface, title_rect)

        subtitle_surface = self.body_font.render(subtitle, True, (205, 216, 236))
        subtitle_rect = subtitle_surface.get_rect(center=(rect.centerx, rect.top + int(rect.height * 0.68)))
        self.screen.blit(subtitle_surface, subtitle_rect)

    def _draw_difficulty_chip(self, rect: pygame.Rect, label: str, selected: bool, enabled: bool) -> None:
        if selected and enabled:
            fill_color = (96, 150, 232)
            border_color = (236, 242, 252)
            text_color = (250, 250, 250)
        elif enabled:
            fill_color = (40, 56, 86)
            border_color = (132, 164, 212)
            text_color = (214, 228, 248)
        else:
            fill_color = (33, 41, 58)
            border_color = (88, 102, 128)
            text_color = (145, 158, 182)

        pygame.draw.rect(self.screen, fill_color, rect, border_radius=9)
        pygame.draw.rect(self.screen, border_color, rect, width=2, border_radius=9)
        label_surface = self.body_font.render(label, True, text_color)
        self.screen.blit(label_surface, label_surface.get_rect(center=rect.center))

    def _draw_game_over_screen(self) -> None:
        if self.result_model is None:
            self.result_model = self._build_result_model(self.game_over_reason)

        self.result_screen.draw(
            surface=self.screen,
            model=self.result_model,
            title_font=self.title_font,
            heading_font=self.heading_font,
            body_font=self.body_font,
            ui_font=self.ui_font,
        )

        hint_surface = self.body_font.render("Enter: Restart   M: Back To Menu", True, (230, 236, 245))
        hint_rect = hint_surface.get_rect(center=(self.width // 2, int(self.height * 0.93)))
        self.screen.blit(hint_surface, hint_rect)

    def _play_sound(self, key: str) -> None:
        sound = self.sounds.get(key)
        if sound is not None:
            sound.play()

    def _load_images(self) -> dict[str, Optional[pygame.Surface]]:
        images: dict[str, Optional[pygame.Surface]] = {}
        for fruit_name in FRUIT_TYPES:
            images[fruit_name] = self.asset_loader.load_fruit_sprite(fruit_name)

        images["bomb"] = self.asset_loader.load_bomb_sprite()
        images["heart"] = self.asset_loader.load_heart_sprite()
        images["background"] = self.asset_loader.load_background_source()
        return images

    def _load_sounds(self) -> dict[str, Optional[pygame.mixer.Sound]]:
        return {
            "slice": self.asset_loader.load_sound("slice"),
            "bomb": self.asset_loader.load_sound("bomb"),
            "combo": self.asset_loader.load_sound("combo"),
        }

    def _build_fallback_background(self) -> pygame.Surface:
        background = pygame.Surface((self.width, self.height))
        top_color = (142, 205, 248)
        bottom_color = (224, 244, 255)

        for y in range(self.height):
            t = y / max(1, self.height - 1)
            color = (
                int(top_color[0] + (bottom_color[0] - top_color[0]) * t),
                int(top_color[1] + (bottom_color[1] - top_color[1]) * t),
                int(top_color[2] + (bottom_color[2] - top_color[2]) * t),
            )
            pygame.draw.line(background, color, (0, y), (self.width, y))

        cloud_layer = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        rng = random.Random(1337)
        cloud_count = max(6, self.width // 220)
        for _ in range(cloud_count):
            cx = rng.randint(-80, self.width + 80)
            cy = rng.randint(30, max(60, int(self.height * 0.45)))
            cloud_w = rng.randint(120, 240)
            cloud_h = rng.randint(45, 90)
            alpha = rng.randint(55, 95)
            cloud_color = (255, 255, 255, alpha)
            pygame.draw.ellipse(cloud_layer, cloud_color, (cx, cy, cloud_w, cloud_h))
            pygame.draw.ellipse(cloud_layer, cloud_color, (cx + 28, cy - 14, int(cloud_w * 0.55), int(cloud_h * 0.78)))
            pygame.draw.ellipse(cloud_layer, cloud_color, (cx - 24, cy - 8, int(cloud_w * 0.48), int(cloud_h * 0.72)))
        background.blit(cloud_layer, (0, 0))

        horizon_height = max(26, int(self.height * 0.12))
        horizon_rect = pygame.Rect(0, self.height - horizon_height, self.width, horizon_height)
        pygame.draw.rect(background, (215, 235, 245), horizon_rect)
        return background

    def _refresh_background(self) -> None:
        if self.background_source is None:
            self.background = None
            return

        self.background = pygame.transform.smoothscale(self.background_source, (self.width, self.height))

    def _update_fonts(self) -> None:
        ui_scale = min(self.width / SCREEN_WIDTH, self.height / SCREEN_HEIGHT)
        self.title_font = pygame.font.Font(None, max(56, int(96 * ui_scale)))
        self.heading_font = pygame.font.Font(None, max(40, int(64 * ui_scale)))
        self.ui_font = pygame.font.Font(None, max(28, int(40 * ui_scale)))
        self.body_font = pygame.font.Font(None, max(24, int(36 * ui_scale)))

    def _rescale_runtime_objects(self, scale_x: float, scale_y: float) -> None:
        for obj in self.objects:
            obj.position.x *= scale_x
            obj.position.y *= scale_y
            obj.constrain_horizontal(self.width)

        for particle in self.particles:
            particle.pos.x *= scale_x
            particle.pos.y *= scale_y

        self.blast_center.x *= scale_x
        self.blast_center.y *= scale_y
        self.blade.rescale(scale_x, scale_y)
        self.ai_player.rescale(scale_x, scale_y)

    def _random_spawn_x(self, object_radius: float) -> float:
        left_bound = max(object_radius, 0.0)
        right_bound = max(left_bound, self.width - object_radius)
        return random.uniform(left_bound, right_bound)

    def _difficulty_progress_score(self) -> float:
        if self.active_mode == MODE_AI_VS_HUMAN:
            # Use average score so increased spawn rates remain fair in PvAI mode.
            return (self.human_player.score + self.ai_player.score) * 0.5
        return float(self.human_player.score)

    def _round_progress(self) -> float:
        if self.active_mode != MODE_AI_VS_HUMAN:
            return 0.0

        elapsed = AI_VS_HUMAN_ROUND_SECONDS - self.round_time_remaining
        progress = elapsed / AI_VS_HUMAN_ROUND_SECONDS
        return max(0.0, min(1.0, progress))

    @staticmethod
    def _format_timer(seconds: float) -> str:
        clamped_seconds = max(0, int(seconds + 0.999))
        minutes = clamped_seconds // 60
        remainder = clamped_seconds % 60
        return f"{minutes:02d}:{remainder:02d}"

    def _handle_pointer_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.FINGERDOWN:
            if self._active_touch_id is None:
                self._active_touch_id = event.finger_id
            if event.finger_id == self._active_touch_id:
                self._touch_active = True
                self._touch_position = pygame.Vector2(self._finger_to_surface_coords(event.x, event.y))
            return

        if event.type == pygame.FINGERMOTION and event.finger_id == self._active_touch_id:
            self._touch_position = pygame.Vector2(self._finger_to_surface_coords(event.x, event.y))
            return

        if event.type == pygame.FINGERUP and event.finger_id == self._active_touch_id:
            self._touch_active = False
            self._active_touch_id = None

    def _current_pointer_input(self) -> tuple[tuple[int, int], bool]:
        if self._touch_active:
            touch_x = int(round(self._touch_position.x))
            touch_y = int(round(self._touch_position.y))
            return (touch_x, touch_y), True

        mouse_pressed = pygame.mouse.get_pressed(num_buttons=3)[0]
        return pygame.mouse.get_pos(), mouse_pressed

    def _screen_bounds(self) -> tuple[float, float, float, float]:
        return 0.0, 0.0, float(self.width), float(self.height)

    def _point_inside_screen(self, point: pygame.Vector2) -> bool:
        return 0.0 <= point.x <= self.width and 0.0 <= point.y <= self.height

    def _clamp_to_screen(self, point: pygame.Vector2) -> pygame.Vector2:
        return pygame.Vector2(
            max(0.0, min(point.x, float(self.width))),
            max(0.0, min(point.y, float(self.height))),
        )

    def _finger_to_surface_coords(
        self,
        x_norm: float,
        y_norm: float,
        clamp: bool = False,
    ) -> tuple[int, int]:
        pixel_point = pygame.Vector2(x_norm * self.width, y_norm * self.height)
        if not clamp or self._point_inside_screen(pixel_point):
            return int(round(pixel_point.x)), int(round(pixel_point.y))

        clamped = self._clamp_to_screen(pixel_point)
        return int(round(clamped.x)), int(round(clamped.y))

    def _update_menu_layout(self) -> None:
        card_width = max(220, min(330, int(self.width * 0.28)))
        card_height = max(118, min(170, int(self.height * 0.20)))
        card_gap = max(18, min(48, int(self.width * 0.035)))
        total_width = (card_width * 2) + card_gap
        card_left = (self.width // 2) - (total_width // 2)
        card_top = int(self.height * 0.33)

        self.menu_mode_rects[MODE_CLASSIC] = pygame.Rect(card_left, card_top, card_width, card_height)
        self.menu_mode_rects[MODE_AI_VS_HUMAN] = pygame.Rect(card_left + card_width + card_gap, card_top, card_width, card_height)

        chip_width = max(92, min(132, int(self.width * 0.115)))
        chip_height = max(34, min(52, int(self.height * 0.07)))
        chip_gap = max(12, int(self.width * 0.012))
        chip_total = (chip_width * len(DifficultyManager.LEVEL_ORDER)) + (chip_gap * (len(DifficultyManager.LEVEL_ORDER) - 1))
        chip_left = (self.width // 2) - (chip_total // 2)
        chip_top = self.menu_mode_rects[MODE_AI_VS_HUMAN].bottom + max(30, int(self.height * 0.04))

        self.menu_difficulty_rects = {}
        x_pos = chip_left
        for level in DifficultyManager.LEVEL_ORDER:
            self.menu_difficulty_rects[level] = pygame.Rect(x_pos, chip_top, chip_width, chip_height)
            x_pos += chip_width + chip_gap

        start_width = max(230, min(340, int(self.width * 0.28)))
        start_height = max(50, min(72, int(self.height * 0.10)))
        start_x = (self.width // 2) - (start_width // 2)
        start_y = chip_top + chip_height + max(24, int(self.height * 0.045))
        self.menu_start_rect = pygame.Rect(start_x, start_y, start_width, start_height)
