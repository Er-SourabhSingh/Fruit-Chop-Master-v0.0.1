from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class AIDifficultyProfile:
    key: str
    label: str
    fruit_hit_chance_range: tuple[float, float]
    reaction_delay_range: tuple[float, float]
    combo_chance_range: tuple[float, float]
    bomb_avoidance: float

    def sample_fruit_hit_chance(self, rng: random.Random) -> float:
        return rng.uniform(*self.fruit_hit_chance_range)

    def sample_reaction_delay(self, rng: random.Random) -> float:
        return rng.uniform(*self.reaction_delay_range)

    def sample_combo_chance(self, rng: random.Random) -> float:
        return rng.uniform(*self.combo_chance_range)


class DifficultyManager:
    DEFAULT_LEVEL = "medium"
    LEVEL_ORDER = ("easy", "medium", "hard")
    PROFILES = {
        "easy": AIDifficultyProfile(
            key="easy",
            label="Easy",
            fruit_hit_chance_range=(0.45, 0.55),
            reaction_delay_range=(0.40, 0.70),
            combo_chance_range=(0.10, 0.15),
            bomb_avoidance=0.60,
        ),
        "medium": AIDifficultyProfile(
            key="medium",
            label="Medium",
            fruit_hit_chance_range=(0.60, 0.70),
            reaction_delay_range=(0.25, 0.45),
            combo_chance_range=(0.20, 0.30),
            bomb_avoidance=0.80,
        ),
        "hard": AIDifficultyProfile(
            key="hard",
            label="Hard",
            fruit_hit_chance_range=(0.75, 0.85),
            reaction_delay_range=(0.12, 0.25),
            combo_chance_range=(0.35, 0.45),
            bomb_avoidance=0.92,
        ),
    }

    @classmethod
    def profile_for(cls, level: str) -> AIDifficultyProfile:
        return cls.PROFILES.get(level.lower(), cls.PROFILES[cls.DEFAULT_LEVEL])

    @classmethod
    def cycle_level(cls, current: str, step: int) -> str:
        try:
            index = cls.LEVEL_ORDER.index(current)
        except ValueError:
            index = cls.LEVEL_ORDER.index(cls.DEFAULT_LEVEL)

        return cls.LEVEL_ORDER[(index + step) % len(cls.LEVEL_ORDER)]
