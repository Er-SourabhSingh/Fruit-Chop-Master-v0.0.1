from __future__ import annotations

import json
import random
from dataclasses import dataclass
from math import sqrt
from pathlib import Path
from typing import Optional

import pygame

from asset_loader import AssetLoader
from blade import Blade
from bomb import Bomb
from fruit import FRUIT_TYPES, Fruit
from heart_pickup import HeartPickup

SCREEN_WIDTH = 1280
SCREEN_HEIGHT = 720
FPS = 60
STARTING_LIVES = 3
MAX_LIVES = 5
SKIPS_PER_LIFE_LOSS = 5


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

        self.blade = Blade()
        self.objects: list[Fruit] = []
        self.particles: list[JuiceParticle] = []

        self.score = 0
        self.lives = STARTING_LIVES
        self.skipped_fruits = 0
        self.elapsed_time = 0.0
        self.spawn_cooldown = 0.0
        self.heart_spawn_cooldown = random.uniform(4.5, 7.0)
        self.spawn_interval = 0.9
        self.speed_multiplier = 1.0
        self.combo_text = ""
        self.combo_timer = 0.0
        self.blast_center = pygame.Vector2(self.width * 0.5, self.height * 0.5)
        self.blast_timer = 0.0
        self.blast_duration = 0.5
        self.high_score_file = self.base_path / "data" / "highscore.json"
        self.high_score = self._load_high_score()
        self.new_high_score_achieved = False

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

    def handle_events(self, events: list[pygame.event.Event]) -> None:
        for event in events:
            if event.type == pygame.KEYDOWN and self.state in {"start", "game_over"}:
                self.start_game()
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.state in {"start", "game_over"}:
                self.start_game()

    def start_game(self) -> None:
        self.state = "running"
        self.score = 0
        self.lives = STARTING_LIVES
        self.skipped_fruits = 0
        self.elapsed_time = 0.0
        self.spawn_cooldown = 0.35
        self.heart_spawn_cooldown = random.uniform(4.5, 7.0)
        self.spawn_interval = 0.9
        self.speed_multiplier = 1.0
        self.combo_text = ""
        self.combo_timer = 0.0
        self.blast_timer = 0.0
        self.new_high_score_achieved = False
        self.objects.clear()
        self.particles.clear()
        self.blade.reset()

    def update(self, dt: float) -> None:
        now = pygame.time.get_ticks() / 1000.0
        mouse_pressed = pygame.mouse.get_pressed(num_buttons=3)[0]
        self.blade.update(pygame.mouse.get_pos(), mouse_pressed, now)

        self._update_particles(dt)
        if self.combo_timer > 0.0:
            self.combo_timer = max(0.0, self.combo_timer - dt)

        if self.state == "bomb_blast":
            self._update_bomb_blast(dt)
            return

        if self.state != "running":
            return

        self._update_difficulty(dt)
        self._handle_spawning(dt)

        for obj in self.objects:
            obj.update(dt)
            obj.constrain_horizontal(self.width)

        self._handle_slicing()
        if self.state != "running":
            return

        self._handle_missed_objects()
        if self.state != "running":
            return

        self._handle_combo_bonus()

    def draw(self) -> None:
        self._draw_background()
        self._draw_particles()

        if self.state == "start":
            self._draw_start_screen()
            self.blade.draw(self.screen)
            return

        if self.state == "running":
            for obj in self.objects:
                obj.draw(self.screen)

            self.blade.draw(self.screen)
            self._draw_hud()
            self._draw_combo_text()
            return

        if self.state == "bomb_blast":
            self._draw_hud()
            self._draw_bomb_blast_effect()
            return

        self._draw_game_over_screen()
        self.blade.draw(self.screen)

    def _update_difficulty(self, dt: float) -> None:
        self.elapsed_time += dt
        if self.score <= 20:
            target_speed = 1.0
            target_interval = 0.9
        elif self.score <= 50:
            mid_progress = (self.score - 20) / 30.0
            target_speed = 1.0 + (0.28 * mid_progress)
            target_interval = 0.9 - (0.13 * mid_progress)
        else:
            high_progress = self.score - 50
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
        difficulty = min(1.0, self.score / 85.0)
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

        bomb_chance = min(0.24, 0.10 + (self.score * 0.0018))
        if random.random() < bomb_chance:
            self._spawn_bomb(position=(x_pos, y_pos), velocity=(vx, vy), gravity=gravity, scale=scale)
            return

        self._spawn_fruit(position=(x_pos, y_pos), velocity=(vx, vy), gravity=gravity, scale=scale)

    def _build_launch_profile(self) -> tuple[float, float, float, float]:
        # Scale movement by window height to keep relative game feel stable.
        motion_scale = max(0.75, min(1.7, self.height / SCREEN_HEIGHT))
        difficulty_scale = 1.0 + ((self.speed_multiplier - 1.0) * 0.9)

        # Randomized projectile target peak:
        # 30% to 108% of screen-height rise gives low/mid/high arcs, including near-top flights.
        rise_ratio = random.uniform(0.30, 1.08)
        rise_distance = self.height * rise_ratio

        gravity = random.uniform(820, 1120) * motion_scale * difficulty_scale
        vy = -sqrt(max(1.0, 2.0 * gravity * rise_distance))
        vy *= random.uniform(0.97, 1.05)

        # Horizontal spread is intentionally limited to avoid off-screen side exits.
        horizontal_range = max(85.0, self.width * 0.11) * motion_scale
        horizontal_boost = 1.0 + ((self.speed_multiplier - 1.0) * 0.35)
        vx = random.uniform(-horizontal_range, horizontal_range) * horizontal_boost

        # Scale object size with window size to preserve readability.
        size_scale = max(0.72, min(1.35, min(self.width / SCREEN_WIDTH, self.height / SCREEN_HEIGHT)))
        scale = random.uniform(0.78, 1.08) * size_scale
        return vx, vy, gravity, scale

    def _should_spawn_heart(self) -> bool:
        if self.heart_spawn_cooldown > 0.0:
            return False

        # Hearts are intentionally much rarer than fruits and also rate-limited by cooldown.
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
        segments = self.blade.get_segments()
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

    def _handle_missed_objects(self) -> None:
        remaining: list[Fruit] = []

        for obj in self.objects:
            if obj.off_screen(self.height):
                if self._is_regular_fruit(obj):
                    self._apply_missed_fruit_penalty()
                    if self.state == "game_over":
                        return
                continue

            remaining.append(obj)

        self.objects = remaining

    def _slice_fruit(self, fruit: Fruit) -> None:
        fruit.slice()
        self.score += 1
        self.blade.register_slice()
        self._spawn_juice_splash(fruit.position, fruit.color)
        self._play_sound("slice")

    def _collect_heart(self, heart: HeartPickup) -> None:
        heart.slice()
        if self.lives < MAX_LIVES:
            self.lives += 1

        self._spawn_juice_splash(heart.position, heart.color)
        self._play_sound("slice")

    def _handle_bomb_hit(self, bomb: Bomb) -> None:
        bomb.slice()
        self._trigger_bomb_blast(bomb.position)

    def _apply_missed_fruit_penalty(self) -> None:
        self.skipped_fruits += 1
        if self.skipped_fruits >= SKIPS_PER_LIFE_LOSS:
            self.skipped_fruits = 0
            self._apply_life_loss()

    def _apply_life_loss(self) -> None:
        self.lives -= 1
        if self.lives <= 0:
            self._trigger_game_over()

    @staticmethod
    def _is_regular_fruit(obj: Fruit) -> bool:
        return not isinstance(obj, (Bomb, HeartPickup))

    def _trigger_game_over(self) -> None:
        if self.state == "game_over":
            return

        self._finalize_high_score()
        self.state = "game_over"
        self.objects.clear()
        self.blade.reset()

    def _finalize_high_score(self) -> None:
        if self.score > self.high_score:
            self.high_score = self.score
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
            # High score persistence failure should not crash gameplay.
            return

    def _trigger_bomb_blast(self, position: pygame.Vector2) -> None:
        self.state = "bomb_blast"
        self.blast_center = position.copy()
        self.blast_timer = self.blast_duration
        self.objects.clear()
        self.blade.reset()
        self._play_sound("bomb")

        for _ in range(3):
            self._spawn_juice_splash(position, (255, 88, 72))

    def _handle_combo_bonus(self) -> None:
        sliced_in_swipe = self.blade.consume_combo_hits()
        if sliced_in_swipe <= 1:
            return

        bonus = self._combo_bonus_for_hits(sliced_in_swipe)
        self.score += bonus

        if sliced_in_swipe == 2:
            self.combo_text = f"Combo x2  +{bonus}"
        elif sliced_in_swipe == 3:
            self.combo_text = f"Great Slice! Combo x3  +{bonus}"
        elif sliced_in_swipe == 4:
            self.combo_text = f"Awesome Combo! x4  +{bonus}"
        else:
            self.combo_text = f"Legendary Combo x{sliced_in_swipe}  +{bonus}"

        self.combo_timer = 1.0
        self._play_sound("combo")

    @staticmethod
    def _combo_bonus_for_hits(sliced_in_swipe: int) -> int:
        if sliced_in_swipe == 2:
            return 1
        if sliced_in_swipe == 3:
            return 2
        if sliced_in_swipe == 4:
            return 4
        return 4 + ((sliced_in_swipe - 4) * 2)

    def _update_bomb_blast(self, dt: float) -> None:
        self.blast_timer = max(0.0, self.blast_timer - dt)
        if self.blast_timer <= 0.0:
            self._trigger_game_over()

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
        padding_x = max(16, int(self.width * 0.016))
        padding_y = max(14, int(self.height * 0.02))

        score_surface = self.ui_font.render(f"Score: {self.score}", True, (245, 245, 245))
        self.screen.blit(score_surface, (padding_x, padding_y))

        hearts = " ".join("\u2764" for _ in range(max(0, self.lives)))
        if not hearts:
            hearts = "0"
        lives_surface = self.ui_font.render(f"Lives: {hearts}", True, (255, 92, 92))
        lives_rect = lives_surface.get_rect(midtop=(self.width // 2, padding_y))
        self.screen.blit(lives_surface, lives_rect)

        skipped_surface = self.ui_font.render(
            f"Skipped: {self.skipped_fruits}/{SKIPS_PER_LIFE_LOSS}",
            True,
            (245, 225, 225),
        )
        skipped_rect = skipped_surface.get_rect(topright=(self.width - padding_x, padding_y))
        self.screen.blit(skipped_surface, skipped_rect)

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
        pygame.draw.circle(overlay, (255, 240, 220, 205), center_xy, ring_radius, width=max(2, int(8 * (1.0 - progress))))
        self.screen.blit(overlay, (0, 0))

    def _draw_combo_text(self) -> None:
        if self.combo_timer <= 0.0 or not self.combo_text:
            return

        alpha = int(255 * min(1.0, self.combo_timer / 1.0))
        text_surface = self.heading_font.render(self.combo_text, True, (255, 220, 120))
        text_surface.set_alpha(alpha)
        text_rect = text_surface.get_rect(center=(self.width // 2, max(56, int(self.height * 0.12))))
        self.screen.blit(text_surface, text_rect)

    def _draw_start_screen(self) -> None:
        title = self.title_font.render("FRUIT SLICE", True, (250, 250, 250))
        subtitle = self.body_font.render("Press any key or click to start", True, (220, 220, 220))
        hint_1 = self.body_font.render("Drag the mouse to slice fruit", True, (200, 200, 200))
        hint_2 = self.body_font.render("Slice bomb = instant game over", True, (215, 130, 130))

        center_x = self.width // 2
        center_y = self.height // 2

        self.screen.blit(title, title.get_rect(center=(center_x, center_y - int(self.height * 0.12))))
        self.screen.blit(subtitle, subtitle.get_rect(center=(center_x, center_y + int(self.height * 0.02))))
        self.screen.blit(hint_1, hint_1.get_rect(center=(center_x, center_y + int(self.height * 0.09))))
        self.screen.blit(hint_2, hint_2.get_rect(center=(center_x, center_y + int(self.height * 0.15))))

    def _draw_game_over_screen(self) -> None:
        overlay = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 170))
        self.screen.blit(overlay, (0, 0))

        game_over = self.title_font.render("GAME OVER", True, (255, 95, 95))
        final_score = self.heading_font.render(f"Score: {self.score}", True, (245, 245, 245))
        best_score = self.heading_font.render(f"Best: {self.high_score}", True, (255, 225, 130))
        new_high = self.body_font.render("New High Score!", True, (255, 235, 90))
        restart = self.body_font.render("Press any key or click to restart", True, (220, 220, 220))

        center_x = self.width // 2
        center_y = self.height // 2
        self.screen.blit(game_over, game_over.get_rect(center=(center_x, center_y - int(self.height * 0.10))))
        self.screen.blit(final_score, final_score.get_rect(center=(center_x, center_y + int(self.height * 0.01))))
        self.screen.blit(best_score, best_score.get_rect(center=(center_x, center_y + int(self.height * 0.08))))
        if self.new_high_score_achieved:
            self.screen.blit(new_high, new_high.get_rect(center=(center_x, center_y + int(self.height * 0.145))))
            restart_y = center_y + int(self.height * 0.21)
        else:
            restart_y = center_y + int(self.height * 0.17)

        self.screen.blit(restart, restart.get_rect(center=(center_x, restart_y)))

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

        # Soft cloud layer keeps the scene bright and arcade-like.
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

        # A very light horizon strip improves depth while preserving object contrast.
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

    def _random_spawn_x(self, object_radius: float) -> float:
        left_bound = max(object_radius, 0.0)
        right_bound = max(left_bound, self.width - object_radius)
        return random.uniform(left_bound, right_bound)

