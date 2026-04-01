from dataclasses import dataclass


@dataclass
class HumanPlayer:
    score: int = 0
    lives: int = 3
    skipped_fruits: int = 0
    combo_text: str = ""
    combo_timer: float = 0.0

    def reset(self, starting_lives: int) -> None:
        self.score = 0
        self.lives = starting_lives
        self.skipped_fruits = 0
        self.combo_text = ""
        self.combo_timer = 0.0

    def update_timers(self, dt: float) -> None:
        if self.combo_timer > 0.0:
            self.combo_timer = max(0.0, self.combo_timer - dt)

    def register_missed_fruit(self, skips_per_life_loss: int) -> bool:
        self.skipped_fruits += 1
        if self.skipped_fruits < skips_per_life_loss:
            return False

        self.skipped_fruits = 0
        return True

    def lose_life(self) -> bool:
        self.lives -= 1
        return self.lives <= 0
